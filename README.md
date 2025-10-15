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




## Design Thinking

This section covers the raw thought process that led to the final design - a multi-agent, multi-human setup.

We have two actors - **AI Agents** and **human approvers**.

#### 1. An AI Agent initiates a workflow step over the network.

We implement a rest endpoint `api/approval` in `forwarder` service. This gives our system flexibility to connect with in-house and third-party MCP/non-MCP servers.
AI agent sends a request payload. The payload schema at this point is ambiguous, so let's start with the bare minimum - we need a unique identifier for the chat bubble the AI wants the request - `contextId` in our system.
A secondary `streamId` which identifies the unique thread of the conversation can also be stored for future requirements. 

#### 2. Forwarder process `api/approval` request payload

First thought - write it in DB. But at scale, implementing retries and potentially heavy tasks for future requirements can slow down `api/approval` request latency for the agent.
Resolution - push to an `asynchronous event queue` and return success status (ideally 202 - queued). 
We shall use `Kafka` for our queue. Why? Kafka is a high-throughput, distributed streaming platform ideal for real-time data pipelines. 
In places where a flexible message broker is required (handling notifications, for example) we can also explore using `RabbitMQ` at scale alongside kafka. 

### Kafka

Kafka will have the following topics:
- Topic 1: Workflow events
Requests from AI Agent comes here

- Topic 2: Human Responses
  Approval updates from humans come here

- Topic 3: Notification processor
  Handle sending notification events

- Topic 4: Dead Letter Queue (DLQ)
  Failed events are retried here

 
#### 3. Materializers for consuming from Kafka

`Materializers` in our system will act as asynchronous workers with three main tasks:
1. Pop from queue
2. Write to DB with transaction and retries/ Send notifications / Other async tasks
3. (If required) Push new asynchronous events to queue (a different kafka topic)

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
 3. Starts async task corresponding to each channel, resolves with Promise.all() - scaled horizontally
 4. If required, can have dedicated workers handling one type of channel.

#### 5. The frontend



