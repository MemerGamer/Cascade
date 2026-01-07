import { Subject, Observable, EMPTY } from "rxjs";
import {
  map,
  filter,
  retry,
  catchError,
  tap,
  mergeMap,
  bufferTime,
  share,
} from "rxjs/operators";
import type { EachMessagePayload } from "kafkajs";
import { KafkaClient } from "./index";

export interface KafkaEvent<T = any> {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  data: T;
  raw: EachMessagePayload;
}

export class ReactiveKafkaConsumer {
  private eventSubject = new Subject<EachMessagePayload>();
  private kafkaClient: KafkaClient;

  constructor(clientId: string, brokers: string[]) {
    this.kafkaClient = new KafkaClient(clientId, brokers);
  }

  async connect(groupId: string, topics: string[], fromBeginning = false) {
    await this.kafkaClient.connectConsumer(groupId, topics, fromBeginning);
    await this.kafkaClient.consume(async (payload) => {
      this.eventSubject.next(payload);
    });
  }

  // Returns a shared Observable stream of parsed events
  getEventStream<T = any>(): Observable<KafkaEvent<T>> {
    return this.eventSubject.asObservable().pipe(
      map((payload) => this.parsePayload<T>(payload)),
      share() // Share stream among multiple subscribers
    );
  }

  // Filter by specific topics
  filterByTopic<T = any>(...topics: string[]): Observable<KafkaEvent<T>> {
    return this.getEventStream<T>().pipe(
      filter((event) => topics.includes(event.topic))
    );
  }

  // Get stream with automatic retry and error handling
  getResilentStream<T = any>(
    retryCount = 3,
    retryDelay = 1000
  ): Observable<KafkaEvent<T>> {
    return this.getEventStream<T>().pipe(
      retry({ count: retryCount, delay: retryDelay }),
      catchError((err) => {
        console.error("Stream error:", err);
        return EMPTY;
      })
    );
  }

  private parsePayload<T>(payload: EachMessagePayload): KafkaEvent<T> {
    return {
      topic: payload.topic,
      partition: payload.partition,
      offset: payload.message.offset,
      timestamp: payload.message.timestamp,
      data: JSON.parse(payload.message.value?.toString() || "{}") as T,
      raw: payload,
    };
  }

  async disconnect() {
    this.eventSubject.complete();
    await this.kafkaClient.disconnect();
  }
}

// Re-export RxJS operators for convenience
export {
  map,
  filter,
  tap,
  retry,
  catchError,
  mergeMap,
  bufferTime,
  Observable,
  Subject,
  EMPTY,
} from "rxjs";
