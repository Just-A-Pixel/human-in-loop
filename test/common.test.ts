// test/common.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * vi.mock is hoisted by Vitest. Keep all mock objects inside the factory.
 */
vi.mock("kafkajs", async () => {
  const mockProducer = { connect: vi.fn(), disconnect: vi.fn(), send: vi.fn() };
  const mockConsumer = { connect: vi.fn(), subscribe: vi.fn(), disconnect: vi.fn() };
  const mockAdmin = { connect: vi.fn(), createTopics: vi.fn(), disconnect: vi.fn() };

  const MockKafkaConstructor = vi.fn(() => {
    return {
      producer: vi.fn(() => mockProducer),
      consumer: vi.fn(() => mockConsumer),
      admin: vi.fn(() => mockAdmin),
    };
  });

  return {
    Kafka: MockKafkaConstructor,
    logLevel: { INFO: 1, WARN: 2, ERROR: 3 },
  };
});

// Import the module under test AFTER mocking kafkajs
import {
  createKafkaClient,
  createProducer,
  createConsumer,
  ensureTopics,
  TOPICS,
} from "../src/common.js";

describe("common.ts Kafka helpers", () => {
  let mockedKafka: any;

  beforeEach(async () => {
    // Reset mocks and import the mocked module instance
    vi.clearAllMocks();
    // importMock may be async; await it to get the mocked exports
    mockedKafka = await vi.importMock("kafkajs");
  });

  it("createKafkaClient constructs Kafka with default clientId", () => {
    const kafka = createKafkaClient(); // should call mocked Kafka constructor
    const MockCtor = mockedKafka.Kafka as vi.Mock;
    expect(MockCtor).toBeDefined();
    expect(MockCtor).toHaveBeenCalled();
    const calledWith = MockCtor.mock.calls[0][0];
    expect(calledWith).toHaveProperty("clientId");
    expect(calledWith).toHaveProperty("brokers");
    expect(typeof kafka.producer).toBe("function");
    expect(typeof kafka.consumer).toBe("function");
    expect(typeof kafka.admin).toBe("function");
  });

  it("createProducer connects the producer", async () => {
    const producer = await createProducer("test-producer");
    const MockCtor = mockedKafka.Kafka as vi.Mock;
    expect(MockCtor).toHaveBeenCalled();
    // get the mock producer instance created by the mock constructor
    const mockProducerInstance = MockCtor.mock.results[0].value.producer();
    expect(mockProducerInstance.connect).toHaveBeenCalled();
    expect(producer).toBe(mockProducerInstance);
  });

  it("createConsumer connects and subscribes to topics", async () => {
    const topics = [TOPICS.WORKFLOW_EVENTS, TOPICS.APPROVAL_REQUESTS];
    const consumer = await createConsumer("test-group", topics);

    const MockCtor = mockedKafka.Kafka as vi.Mock;
    expect(MockCtor).toHaveBeenCalled();

    const mockConsumerInstance = MockCtor.mock.results[0].value.consumer();
    expect(mockConsumerInstance.connect).toHaveBeenCalled();
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledTimes(topics.length);
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledWith({ topic: TOPICS.WORKFLOW_EVENTS, fromBeginning: true });
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledWith({ topic: TOPICS.APPROVAL_REQUESTS, fromBeginning: true });
    expect(consumer).toBe(mockConsumerInstance);
  });

  it("ensureTopics calls admin.createTopics with configured topic names", async () => {
    await ensureTopics();

    const MockCtor = mockedKafka.Kafka as vi.Mock;
    const mockAdminInstance = MockCtor.mock.results[0].value.admin();
    expect(mockAdminInstance.connect).toHaveBeenCalled();
    expect(mockAdminInstance.createTopics).toHaveBeenCalled();
    const createdArg = mockAdminInstance.createTopics.mock.calls[0][0];
    expect(createdArg).toHaveProperty("topics");
    const topicNames = createdArg.topics.map((t: any) => t.topic);
    expect(topicNames).toContain(TOPICS.WORKFLOW_EVENTS);
    expect(topicNames).toContain(TOPICS.APPROVAL_REQUESTS);
    expect(topicNames).toContain(TOPICS.HUMAN_RESPONSES);
    expect(mockAdminInstance.disconnect).toHaveBeenCalled();
  });
});
