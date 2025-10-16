# Human-in-the-Loop Approval Orchestrator  
**Event-driven, State-Aware, and Asynchronous Approval System**

> “Don’t just code. Engineer Intelligence.” – Lyzr Hackathon 2025

---


## 🧩 Feature Requirements (Guidelines)

1. Support some kind of approve/disapprove/feedback mechanism with flexible input capture.
2. Think about a configurable frontend structure in terms of approvals?
3. Keep it event-driven — actions and responses should flow asynchronously, not via direct calls.
4. You’ll need a state mechanism to track progress — but what’s the right model? database? event log? hybrid?
5. Maybe integrate with Slack or Gmail to send or receive approvals — or any other creative channel.
6. Don’t forget retries, timeouts, or deadlines — human latency is unpredictable.


Video of demo: https://drive.google.com/file/d/1pJAxS5mzj7XJZ7bKxepUw-NxvWRQyweX/view?usp=sharing
n8n webhook is used for notifications in both cases - notifying human and notifying ai agent. 
***What's happening in the video?***
1. Activate n8n webhook to listen to notification event.
2. Send a post request to `POST api/approval`. Payload details can be found in Design Thinking section.
3. My email gets updated that there is a new approval.
4. Restart n8n webhook (it closes after one use in test, and I can use only one in a workflow).
5. Hit approve. Request gets queued and frontend polls for update at `GET /api/approval/{contextId}/status` until SLA expiration.
6. Approval status updated, corresponding AI agent webhook (again, n8n in this case) gets notified.

## Design Thinking

This section covers the raw thought process that led to the final design - a multi-agent, multi-human setup:

<img width="1577" height="1044" alt="image" src="https://github.com/user-attachments/assets/4c1d5ba3-fa29-4cd6-8061-4e6ba13a9ba9" />

We have two actors - **AI Agents** and **human approvers**.

#### 1. An AI Agent initiates a workflow step over the network.

We implement a rest endpoint `api/approval` in `forwarder` service. This gives our system flexibility to connect with in-house and third-party MCP/non-MCP servers.
AI agent sends a request payload. The payload schema at this point is ambiguous, so let's start with the bare minimum - we need a unique identifier for the chat bubble the AI wants the request - `contextId` in our system.
A secondary `sessionId` which identifies the unique thread of the conversation can also be stored for future requirements. 

#### 2. Forwarder process `api/approval` request payload

First thought - write it in DB. But at scale, implementing retries and potentially heavy tasks for future requirements can slow down `api/approval` request latency for the agent.
Resolution - push to an `asynchronous event queue` and return success status (ideally 202 - queued). 
We shall use `Kafka` for our queue. Kafka is suitable for a high-throughput, distributed streaming platform ideal for real-time data pipelines. 
In places where a flexible message broker is required (handling notifications, for example) we can also explore using `RabbitMQ` at scale alongside kafka. In RabbitMQ, the producer sends and monitors if the message reaches the intended consumer.  

Note: In production, there should be a load balancer.

### Kafka

Kafka will have the following topics:
- Topic 1: Workflow events
Requests from AI Agent comes here

- Topic 2: Human Responses
  Approval updates from humans come here

- Topic 3: Notification processor
  Handle sending notification events

- Topic 4: Dead Letter Queue (DLQ)
  Failed events are processed here. Alternatively, we can use a dedicated queue for each service at the cost of infrastructure overhead. 

 
#### 3. Materializers for consuming from Kafka

`Materializers` in our system will act as asynchronous workers with three main tasks:
1. Pop from queue
2. Write to DB with transaction and retries/ Send notifications / Other async tasks
3. (If required) Push new asynchronous events to queue (a different kafka topic)

On failure, currently data is logged on console. We can extend it to have a dedicated metrics emitter and a DLQ.

Having one materializer for one task enables granular control on horizontally scaling a specific materializer based on event throughput. 

4 materializers were identified:
1. Handle ai agent requests  --> Write to DB and push notification event to queue
2. Update approval status  --> Human approvals are updated here
3. Handle notification events  --> All notification workers are here
4. Handle event log requests - Can be a mix between transactional db writes and queue events as the system scales.

More workers can easily be added to add new async tasks. 

#### 4. A human gets notified 

1. Pulls notification events from queue
2. Gets corresponding user data and valid notifications channels from a `channels` table. (For demo, n8n webhook is used for notifying via emails)
3. Starts async task corresponding to each channel, resolves with Promise.all() - scaled horizontally. Alternatively, each channel can have its own dedicated worker. 

#### 5. The frontend

The main challenge here is having a dynamic, yet controlled UI. 

We will show the human the last few turns of the conversation. As for UI, we will use an n-ary tree based UI schema, where each node maps to a UI component we own. 
The n-ary tree schema will be sent in the request payload.

The request payload that the AI agent will send now looks like this:

```
{
    "sessionId": "11111111-1111-1111-1111-111111111111"                      // Unique thread id
    "title": "Deploy checkout service v1.2.3 to production",                 // Title of the task
    "description": "Executing production deployment.",                       // Description of the task
    "approver": "test",                                                      // Unique human username
    "snapshot": {                                                            // Everything required for agent's state      
          "contextId": "abc-123-456"                                         // Unique chatbubble id
          "turns": [                                                         // The last n turns of a conversation 
              {
                "role": "user",                                              // Who's turn it was
                "ui_schema": {                                               // UI schema for this turn
                      "render_type": "chat-box",                             // render_type maps to a UI component on the frontend
                      "text": "Deploy checkout service to prod"              // Each render_type has a corresponding data object, like text, diff file, etc.
                                                                             // No children nodes, hence this is leaf node
                }
              },
              {
                "role": "Agent",                                             // Next Turn
                "ui_schema": {
                      "render_type": "boundary",
                      "text": "Deploying to prod",
                      "children": [                                          // Child nodes present
                        {
                           "render_type": "chat-box", 
                           "text": "This release touches payment code."
                        }
                      ]
                }
              },
              {
                "role": "Agent",
                "ui_schema": {
                      "render_type": "boundary", "text": "Deploying to prod",
                      "children": [
                        { "render_type": "diff",
                          "diff_text": "sample s3 link to diff.patch file"   // The diff is ideally an s3 link for a diff.patch file. Demo uses a local sample. 
                        }  
                      ]
                }
              }
          ],
          "webhook": "callback woobhook here",    // Notify the AI agent approval is done. If not provided, AI can request update on api/approval/{contextId}/status 

           ....                                                               // Remaining data that the AI agent needs to rehydrate state.

    }
  
}

```

Snapshot can also contain optional rollback step that can be shown to the user. 

Output of the example payload in UI:

<img width="913" height="919" alt="image" src="https://github.com/user-attachments/assets/23c0b1cf-960c-48ce-9f95-915f1a402752" />

#### 6. Updating approval

1. Approval request is sent to forwarder.
2. Published into `human-approvals` topic in kafka.
3. Consumed by `materializer_humans`, updates db and publishes webhook to `notification-events` topic, if present. (For demo, this is a direct call to webhook, but can be easily refactored similar to "A human gets notified" step). We publish the snapshot data with the webhook, which the AI can use to rehydrate. 
4. If no webhook is present, AI agent can make a request for status update at `GET /api/approval/{contextId}/status`, and get snapshot data as well. 


#### 7. DB schema
Detailed schema is in this file: https://github.com/Just-A-Pixel/human-in-loop/blob/main/backend/migrations/001_init_schema.sql

High level overview:
***approvals table** --> Approval requests, approver details, and json snapshot. Additionally, contextId and turns column added for simpler querying.
***events table*** --> stores logs for auditing and tracking status of approvals
***users table*** --> Stores users which will be filled via auth mechanishm
***channels table*** --> Users with corresponding channel columns (email, whatsapp, etc) that can be added/removed based on support. 
If channel is not null => user can be notified via that channel
***

## Things that can be further improved
1. Improved unit test coverage and type safety
2. Dedicated metrics dashboard and service monitoring (For example, using Elastic stack with Kibana)
3. Using cache-aside caching for loading UI with write-through caching for writes. 
4. Rate limiting, especially useful for controlling rate of AI requests.
5. Load balancer with consistent hashing
6. Using master-slave nodes for DB writes - relying on eventual consistency for having partitions and availibility.
7. Implementing user authentication. We can use JWT.
8. A dedicated component library for making UI with a scaled mapper and automated documentation generation - as UI documentation will be a big part of customer experience and UI-schema will most likely be made by AI agent. 


