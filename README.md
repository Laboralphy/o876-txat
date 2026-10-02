# @laboralphy/o876-txat

Lightweight, in-memory chat channel system for Node.js: users, channels, per-channel powers,
message history, and per-recipient events you can forward to any transport (WebSocket, telnet…).

## Install

```sh
npm install @laboralphy/o876-txat
```

## Usage

```ts
import { System, TXAT_EVENTS, type MessagePostDto } from '@laboralphy/o876-txat';

const chat = new System();

// Every event carries `recv`: the id of the user it should be delivered to.
chat.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, channel, message }: MessagePostDto) => {
    sendTo(recv, `[${channel.id}] ${message.idUser}: ${message.content}`);
});

chat.registerUser('alice');
chat.registerUser('bob');
chat.addChannel('general');
chat.userJoinChannel('alice', 'general');
chat.userJoinChannel('bob', 'general');
chat.postMessage('alice', 'general', 'hello');
```

## Concepts

- **System** — registry of users and channels; re-emits channel events with the channel attached.
- **Channel** — users present, allow-list / block-list, attributes (`PERSISTANT`, `HIDDEN`),
  bounded message history (`maxLines`). A channel with a **tag** is exclusive: joining it makes
  the user leave any other channel with the same tag.
- **UserPresence** — a user's powers (`READ`, `WRITE`, `MODERATE`) on one channel.

## Events

| `TXAT_EVENTS`  | Payload type       | Sent to                         |
| -------------- | ------------------ | ------------------------------- |
| `YOU_JOINED`   | `YouJoinedDto`     | the joining user                |
| `YOU_LEFT`     | `YouLeftDto`       | the leaving user                |
| `USER_JOINED`  | `ChannelJoinedDto` | each user already in channel    |
| `USER_LEFT`    | `ChannelLeftDto`   | each user remaining in channel  |
| `MESSAGE_POST` | `MessagePostDto`   | each user with `READ` power     |
| `CLOSED`       | `ChannelClosedDto` | each user in the closed channel |

## License

ISC
