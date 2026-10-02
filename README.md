# @laboralphy/o876-txat

An embeddable, in-memory chat engine for Node.js. Users, channels, permissions, message history,
all event based.

txat holds the chat **state and rules**, and tells you **who must receive what**. It does not
open sockets, store anything on disk or render text: you plug it into your own transport
(WebSocket, telnet, Socket.IO, a game loop…) and your own display.

It was born inside a MUD server, which is why it handles things like "room" channels a player
automatically switches when moving around, but nothing in it is game-specific.

- Multiple channels per user, multiple users per channel
- Per-user, per-channel powers: read, write, moderate
- Bounded message history per channel (backlog for late joiners)
- Exclusive **tagged** channels (joining one leaves the other of the same tag)
- Private (allow-list) and banned (block-list) access
- Hidden channels (not listed) and persistent channels (survive when empty)
- One event per recipient, so routing to the right connection is trivial
- Written in TypeScript, ships ESM + CommonJS + type declarations, zero runtime dependency

## Install

```sh
npm install @laboralphy/o876-txat
```

Requires Node.js 18 or later.

## Quick start

```ts
import { System, TXAT_EVENTS, type MessagePostDto } from '@laboralphy/o876-txat';

const chat = new System();

// Every event carries `recv`: the id of the user it must be delivered to.
chat.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, channel, message }: MessagePostDto) => {
    const sender = chat.getUser(message.idUser);
    console.log(`to ${recv}: [${channel.id}] ${sender.name}: ${message.content}`);
});

chat.registerUser('u1', 'Alice');
chat.registerUser('u2', 'Bob');
chat.addChannel('general');
chat.userJoinChannel('u1', 'general');
chat.userJoinChannel('u2', 'general');

chat.postMessage('u1', 'general', 'Hello everyone!');
// to u1: [general] Alice: Hello everyone!
// to u2: [general] Alice: Hello everyone!
```

## Core ideas

| Concept          | What it is                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **System**       | The entry point. Registry of users and channels, and the single event emitter you listen to. |
| **User**         | A registered user: `id`, display `name`, and the set of `joinedChannels`.                    |
| **Channel**      | A conversation: present users, access lists, attributes, message history.                    |
| **UserPresence** | A user _inside one channel_: their powers there (`READ`, `WRITE`, `MODERATE`) and a color.   |
| **Message**      | `idUser`, `content`, and `ts` (timestamp in milliseconds).                                   |

Because powers live on the presence, the same user can be a moderator on one channel, muted on
another and a simple reader on a third.

## Wiring a transport

Events are emitted once **per recipient**. You never compute who must receive a message, you
only look up the connection of `recv`:

```ts
import { System, TXAT_EVENTS } from '@laboralphy/o876-txat';
import type {
    MessagePostDto,
    ChannelJoinedDto,
    ChannelLeftDto,
    YouJoinedDto,
    YouLeftDto,
    ChannelClosedDto,
} from '@laboralphy/o876-txat';

const chat = new System();
const connections = new Map<string, { send(data: string): void }>(); // your sockets

function send(idUser: string, payload: object) {
    connections.get(idUser)?.send(JSON.stringify(payload));
}

chat.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, channel, message }: MessagePostDto) =>
    send(recv, {
        type: 'message',
        channel: channel.id,
        from: chat.getUser(message.idUser).name,
        text: message.content,
        ts: message.ts,
    })
);
chat.events.on(TXAT_EVENTS.YOU_JOINED, ({ recv, channel }: YouJoinedDto) =>
    send(recv, { type: 'joined', channel: channel.id, users: channel.users.map((u) => u.id) })
);
chat.events.on(TXAT_EVENTS.YOU_LEFT, ({ recv, channel }: YouLeftDto) =>
    send(recv, { type: 'left', channel: channel.id })
);
chat.events.on(TXAT_EVENTS.USER_JOINED, ({ recv, channel, user }: ChannelJoinedDto) =>
    send(recv, { type: 'user-joined', channel: channel.id, user: user.id })
);
chat.events.on(TXAT_EVENTS.USER_LEFT, ({ recv, channel, user }: ChannelLeftDto) =>
    send(recv, { type: 'user-left', channel: channel.id, user: user.id })
);
chat.events.on(TXAT_EVENTS.CLOSED, ({ recv, channel }: ChannelClosedDto) =>
    send(recv, { type: 'closed', channel: channel.id })
);
```

> Event payloads hold the live `Channel` and `UserPresence` objects. Pick the fields you need,
> as above, rather than serializing the payload as a whole.

### Events reference

| `TXAT_EVENTS`  | Payload type       | Emitted to                                  |
| -------------- | ------------------ | ------------------------------------------- |
| `YOU_JOINED`   | `YouJoinedDto`     | the user who joined                         |
| `YOU_LEFT`     | `YouLeftDto`       | the user who left                           |
| `USER_JOINED`  | `ChannelJoinedDto` | every other user already in the channel     |
| `USER_LEFT`    | `ChannelLeftDto`   | every user remaining in the channel         |
| `MESSAGE_POST` | `MessagePostDto`   | every user of the channel with `READ` power |
| `CLOSED`       | `ChannelClosedDto` | every user of a channel being removed       |

All events are emitted synchronously. When `YOU_JOINED` fires, the user is already present in
the channel with their powers granted.

## What you can do with it

### Show the backlog to a late joiner

Each channel keeps its last `maxLines` messages (1000 by default).

```ts
const lobby = chat.addChannel('lobby');
lobby.maxLines = 50;

chat.events.on(TXAT_EVENTS.YOU_JOINED, ({ recv, channel }: YouJoinedDto) => {
    for (const message of channel.getMessages()) {
        send(recv, { type: 'history', channel: channel.id, text: message.content, ts: message.ts });
    }
});
```

### Mute a user, or let them stop listening

Joining a channel grants `READ` and `WRITE`. Powers can be changed at any time on the presence:

```ts
import { POWERS } from '@laboralphy/o876-txat';

const presence = chat.getChannel('general').getUser('u2');

presence?.revoke(POWERS.WRITE); // muted: postMessage now throws for u2 on this channel
presence?.grant(POWERS.WRITE); // unmuted

presence?.revoke(POWERS.READ); // u2 stays in the channel but no longer receives messages
```

`MODERATE` is not interpreted by txat itself: it is a flag your application checks before
allowing moderation commands (kick, mute others…).

```ts
chat.getChannel('general').getUser('u1')?.grant(POWERS.MODERATE);

function mute(idModerator: string, idTarget: string, idChannel: string) {
    const channel = chat.getChannel(idChannel);
    if (!channel.getUser(idModerator)?.hasPower(POWERS.MODERATE)) {
        throw new Error('not a moderator here');
    }
    channel.getUser(idTarget)?.revoke(POWERS.WRITE);
}
```

### Room channels with tags

A channel can be created with a **tag**. A user can only be in one channel per tag: joining a
tagged channel makes them leave the channel they were in with the same tag. This is ideal for
location-based chat (rooms, zones, game tables, voice-like "currently in" channels):

```ts
chat.addChannel('room:tavern', 'room');
chat.addChannel('room:forge', 'room');

chat.userJoinChannel('u1', 'room:tavern');
chat.userJoinChannel('u1', 'room:forge'); // u1 automatically leaves room:tavern
```

Untagged channels (`general`, `trade`, …) are not affected, so a user can be in many global
channels and exactly one room at a time.

### Ephemeral and persistent channels

By default, a channel is **removed automatically when its last user leaves**: perfect for
on-the-fly channels (a party, a duel, a private conversation). Mark a channel `PERSISTANT` to
keep it alive while empty:

```ts
import { CHANNEL_ATRIBUTES } from '@laboralphy/o876-txat';

chat.addChannel('general').attributes.add(CHANNEL_ATRIBUTES.PERSISTANT);

chat.addChannel('party-42'); // will vanish once everybody has left
```

Since a channel can disappear, check `chat.isChannelExists(id)` before joining and create it on
demand:

```ts
function join(idUser: string, idChannel: string) {
    if (!chat.isChannelExists(idChannel)) {
        chat.addChannel(idChannel);
    }
    chat.userJoinChannel(idUser, idChannel);
}
```

### Hidden channels

`getChannelList()` returns the channels a user may browse. `HIDDEN` channels are left out, which
is handy for staff channels or for the many auto-generated room channels:

```ts
chat.addChannel('staff').attributes.add(CHANNEL_ATRIBUTES.HIDDEN);

chat.getChannelList().map((c) => c.id); // 'staff' is not listed
```

### Private channels and bans

Adding anyone to a channel's `whiteList` makes it **private**: only listed users may join. Users in
the `blackList` can never join.

```ts
const guild = chat.addChannel('guild:dragons');
guild.whiteList.add('u1');
guild.whiteList.add('u2');
guild.private; // true

chat.userJoinChannel('u3', 'guild:dragons'); // throws: not allowed

chat.getChannel('general').blackList.add('u3');
```

Access lists are checked when a user joins. To ban someone who is already in the channel, add
them to the block-list **and** make them leave:

```ts
function ban(idUser: string, idChannel: string) {
    chat.getChannel(idChannel).blackList.add(idUser);
    if (chat.getChannel(idChannel).getUser(idUser)) {
        chat.userLeaveChannel(idUser, idChannel);
    }
}
```

### Colors

Each presence carries a free-form `color` string, so a user can have a different color per
channel. txat stores it; your display decides what it means (CSS color, ANSI code, palette
index…).

```ts
const presence = chat.getChannel('general').getUser('u1');
if (presence) {
    presence.color = '#e6a23c';
}
```

### Closing a channel

`removeChannel` notifies every present user with `CLOSED`, detaches them, and forgets the
channel, persistent or not.

```ts
chat.removeChannel('party-42');
```

### Disconnecting a user

`unregisterUser` makes the user leave every joined channel (others receive `USER_LEFT`, empty
ephemeral channels are removed) and forgets the user:

```ts
if (chat.isUserRegistered('u2')) {
    chat.unregisterUser('u2');
}
```

## API overview

### `System`

| Member                                    | Description                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `events`                                  | `EventEmitter` emitting all `TXAT_EVENTS`                           |
| `registerUser(id, name?)`                 | Register a user (name defaults to id). Throws if already registered |
| `unregisterUser(id)`                      | Leave all channels and forget the user                              |
| `isUserRegistered(id)`                    | `boolean`                                                           |
| `getUser(id)`                             | `User`, throws if not registered                                    |
| `addChannel(id, tag?)`                    | Create a channel. Throws if the id exists                           |
| `removeChannel(id)`                       | Close and forget a channel                                          |
| `isChannelExists(id)`                     | `boolean`                                                           |
| `getChannel(id)`                          | `Channel`, throws if not found                                      |
| `getChannelList()`                        | All channels except `HIDDEN` ones                                   |
| `userJoinChannel(idUser, idChannel)`      | Join with `READ` + `WRITE`, leaving any channel with the same tag   |
| `userLeaveChannel(idUser, idChannel)`     | Leave a channel                                                     |
| `postMessage(idUser, idChannel, content)` | Post a message. Throws if the user has no `WRITE` power there       |

### `Channel`

| Member                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `id`, `tag`              | Identifier and optional exclusivity tag                  |
| `users`                  | Present users, as `UserPresence[]`                       |
| `getUser(idUser)`        | `UserPresence \| undefined`                              |
| `maxLines`               | History size (default 1000)                              |
| `getMessages()`          | Copy of the history, oldest first                        |
| `whiteList`, `blackList` | `Set<string>` of user ids                                |
| `private`                | `true` when the white-list is not empty                  |
| `isAllowed(idUser)`      | Whether the user may join, according to the access lists |
| `attributes`             | `Set<CHANNEL_ATRIBUTES>`: `PERSISTANT`, `HIDDEN`         |

### `UserPresence`

| Member                          | Description                    |
| ------------------------------- | ------------------------------ |
| `id`                            | User id                        |
| `grant(power)`, `revoke(power)` | Chainable power changes        |
| `hasPower(power)`               | `boolean`                      |
| `color`                         | Free-form string, `''` default |

## Limitations

- **In memory only.** Restarting your process clears everything; persist what you need from the
  events.
- **No transport, no formatting.** By design: txat decides _who_ gets _what_, you deliver it.
- **Node.js only** for now (uses `node:events`).

## Upgrading from 1.x

Version 2 is a full TypeScript rewrite with a new API. The last JavaScript version remains
available as [release 1.3.2](https://github.com/Laboralphy/o876-txat/releases/tag/1.3.2) but is no
longer maintained.

## License

ISC © Raphaël Marandet
