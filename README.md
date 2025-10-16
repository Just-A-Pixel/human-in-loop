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

## Design Thinking

This section covers the raw thought process that led to the final design - a multi-agent, multi-human setup:

<img width="1051" height="696" alt="image" src="https://github.com/user-attachments/assets/5fc02159-93de-4e91-9a93-a3d44cb46bd0" />


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
1. Handle ai agent requests (Implemented)  --> Write to DB and push notification event to queue
2. Update approval status (Implemented)  --> Human approvals are updated here
3. Handle notification events 
4. Handle event log requests - Can be a mix between transactional db writes and queue events as the system scales.

More workers can easily be added to add new async tasks. 

#### 4. A human gets notified 

1. Pulls notification events from queue
2. Gets corresponding user data and json array of accepted communication channels
3. Starts async task corresponding to each channel, resolves with Promise.all() - scaled horizontally. Alternatively, each channel can have its own dedicated worker. 
4. If required, can have dedicated workers handling one type of channel.

#### 5. The frontend

The main challenge here is having a dynamic, yet controlled UI. 

We will show the human the last few turns of the conversation. As for UI, we will use an n-ary tree based UI schema, where each node maps to a UI component we own. 
The n-ary tree schema will be sent in the request payload.

The request payload now looks like this:

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


## Things that can be further improved
1. Improved unit test coverage
2. Dedicated metrics dashboard (For example, using Elastic stack with Kibana)
3. Using write back cache
4. Rate limiting


