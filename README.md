# @laboralphy/o876-txat

An embeddable, in-memory chat engine for JavaScript and TypeScript. Users, channels, permissions,
message history, all event based.

txat holds the chat **state and rules**, and tells you **who must receive what**. It does not
open sockets, store anything on disk or render text: you plug it into your own transport
(WebSocket, telnet, Socket.IO, a game loop…) and your own display.

It was born inside a MUD server, which is why it handles things like "room" channels a player
automatically switches when moving around, but nothing in it is game-specific.

- Multiple channels per user, multiple users per channel
- Per-user, per-channel powers: read, write, moderate
- Bounded message history per channel (backlog for late joiners)
- Exclusive **tagged** channels (joining one leaves the other of the same tag)
- Private channels, bans and kicks, enforced on users already present
- Hidden channels (not listed) and persistent channels (survive when empty)
- One event per recipient, so routing to the right connection is trivial
- Fully typed events with plain, serializable payloads
- Written in TypeScript, ships ESM + CommonJS + type declarations, zero dependency

## Install

```sh
npm install @laboralphy/o876-txat
```

Runs on Node.js 20 or later, and on any runtime providing `crypto.randomUUID()` (Deno, Bun,
browsers in a secure context).

## Quick start

```ts
import { System, TXAT_EVENTS } from '@laboralphy/o876-txat';

const chat = new System();

// Every event carries `recv`: the id of the user it must be delivered to.
chat.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, idChannel, message }) => {
    const sender = chat.getUser(message.idUser);
    console.log(`to ${recv}: [${idChannel}] ${sender.name}: ${message.content}`);
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

Listener payloads are inferred from the event name: no need to annotate them.

## Core ideas

| Concept          | What it is                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **System**       | The entry point. Registry of users and channels, and the single event emitter you listen to. |
| **User**         | A registered user: `id`, display `name`, and the set of `joinedChannels`.                    |
| **Channel**      | A conversation: present users, access lists, attributes, message history.                    |
| **UserPresence** | A user _inside one channel_: their powers there (`READ`, `WRITE`, `MODERATE`) and a color.   |
| **Message**      | `id` (UUID), `idChannel`, `idUser`, `content`, and `ts` (timestamp in milliseconds).         |

Because powers live on the presence, the same user can be a moderator on one channel, muted on
another and a simple reader on a third.

## Wiring a transport

Events are emitted once **per recipient**. You never compute who must receive a message, you
only look up the connection of `recv`. Payloads are plain objects, so they can be sent as they
are:

```ts
import { System, TXAT_EVENTS } from '@laboralphy/o876-txat';

const chat = new System();
const connections = new Map<string, { send(data: string): void }>(); // your sockets

for (const event of Object.values(TXAT_EVENTS)) {
    chat.events.on(event, (payload) => {
        connections.get(payload.recv)?.send(JSON.stringify({ event, payload }));
    });
}
```

Or handle each event your own way:

```ts
chat.events.on(TXAT_EVENTS.YOU_LEFT, ({ recv, idChannel, reason }) => {
    const text =
        reason === LEAVE_REASONS.KICKED
            ? `You have been kicked from ${idChannel}.`
            : `You left ${idChannel}.`;
    connections.get(recv)?.send(text);
});
```

### Events reference

| `TXAT_EVENTS`   | Payload                                     | Emitted to                                  |
| --------------- | ------------------------------------------- | ------------------------------------------- |
| `YOU_JOINED`    | `{ recv, idChannel }`                       | the user who joined                         |
| `YOU_LEFT`      | `{ recv, idChannel, reason }`               | the user who left or was kicked             |
| `USER_JOINED`   | `{ recv, idChannel, user }`                 | every other user already in the channel     |
| `USER_LEFT`     | `{ recv, idChannel, user, reason }`         | every user remaining in the channel         |
| `MESSAGE_POST`  | `{ recv, idChannel, user, message }`        | every user of the channel with `READ` power |
| `CLOSED`        | `{ recv, idChannel }`                       | every user of a channel being removed       |
| `POWER_CHANGED` | `{ recv, idChannel, user, power, granted }` | the user whose power was granted or revoked |

- `user` is a snapshot of the presence at the time of the event: `{ id, name, color, powers }`
  (`PresenceDto`). `name` is the name given to `registerUser`.
- `reason` is `LEAVE_REASONS.LEFT` (`'left'`) or `LEAVE_REASONS.KICKED` (`'kicked'`).
- `message` is a `Message`: `{ id, idChannel, idUser, content, ts }`.

Payload types are exported (`YouJoinedDto`, `YouLeftDto`, `UserJoinedDto`, `UserLeftDto`,
`MessagePostDto`, `ChannelClosedDto`, `PowerChangedDto`, `PresenceDto`), as well as the whole map
(`TxatEventMap`).

All events are emitted synchronously. When `YOU_JOINED` fires, the user is already present in
the channel with their powers granted, and the channel is in their `joinedChannels`. When
`YOU_LEFT` or `CLOSED` fires, the channel can still be read with `chat.getChannel(idChannel)`.

The emitter supports `on`, `once`, `off`, `emit`, `listenerCount` and `removeAllListeners`.

### Listener errors

A failing listener never breaks a broadcast: if delivering a message to one user throws (a
closed socket, a bug), every other recipient still gets it, and `postMessage` does not throw.
The error, as well as the rejection of an `async` listener, goes to the emitter's `onError`
handler, which logs to `console.error` by default. Plug in your own logger:

```ts
chat.events.onError = (error, event, payload) => {
    logger.error({ error, event, recv: payload.recv }, 'chat listener failed');
};
```

## What you can do with it

### Show the backlog to a late joiner

Each channel keeps its last `maxLines` messages (1000 by default). Lowering `maxLines` later
trims the history at once.

```ts
chat.addChannel('lobby', { maxLines: 50 });

chat.events.on(TXAT_EVENTS.YOU_JOINED, ({ recv, idChannel }) => {
    for (const message of chat.getChannel(idChannel).getMessages()) {
        send(recv, { type: 'history', ...message });
    }
});
```

Message ids are UUIDs, so clients can deduplicate, or reference a message to reply, quote or
report it.

### Mute a user, or let them stop listening

Joining a channel grants the channel's default powers (`READ` and `WRITE` unless configured
otherwise). Powers can be changed at any time on the presence:

```ts
import { POWERS } from '@laboralphy/o876-txat';

const presence = chat.getChannel('general').getUser('u2');

presence?.revoke(POWERS.WRITE); // muted: postMessage now throws for u2 on this channel
presence?.grant(POWERS.WRITE); // unmuted

presence?.revoke(POWERS.READ); // u2 stays in the channel but no longer receives messages
```

Every actual change is sent to the user concerned as `POWER_CHANGED`, so they can be told they
have been muted:

```ts
chat.events.on(TXAT_EVENTS.POWER_CHANGED, ({ recv, idChannel, power, granted }) => {
    if (power === POWERS.WRITE) {
        send(recv, {
            type: 'notice',
            text: granted
                ? `You can talk again on ${idChannel}`
                : `You have been muted on ${idChannel}`,
        });
    }
});
```

### Read-only channels

Give a channel `defaultPowers` to change what joining users get. An announcements channel where
only staff can write:

```ts
chat.addChannel('news', { persistent: true, defaultPowers: [POWERS.READ] });

chat.userJoinChannel('u1', 'news'); // u1 can read, not write
chat.userJoinChannel('admin', 'news');
chat.getChannel('news').getUser('admin')?.grant(POWERS.WRITE);
chat.postMessage('admin', 'news', 'Server restart at noon');
```

`MODERATE` is not interpreted by txat itself: it is a flag your application checks before
allowing moderation commands.

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

### Kick and ban

```ts
const general = chat.getChannel('general');

general.kick('u3'); // u3 is removed, and may join again
general.ban('u3'); // u3 is removed if present, and can no longer join
general.unban('u3');
```

A kicked or banned user receives `YOU_LEFT` and the others `USER_LEFT`, both with
`reason: 'kicked'`.

### Private channels

Adding users to a channel's white list makes it **private**: only listed users may stay or join.
Access lists are enforced at once: whoever is present and no longer allowed is kicked.

```ts
const guild = chat.addChannel('guild:dragons');
guild.allow('u1');
guild.allow('u2');
guild.private; // true

chat.userJoinChannel('u3', 'guild:dragons'); // throws: not allowed

guild.disallow('u2'); // u2 is kicked if present
```

> Calling `allow()` on a public channel with users in it turns it private and kicks everybody
> not on the list. Set up the white list before users join.

`whiteList` and `blackList` are read-only sets: use `allow` / `disallow` / `ban` / `unban` to
change them.

### Room channels with tags

A channel can be created with a **tag**. A user can only be in one channel per tag: joining a
tagged channel makes them leave the channel they were in with the same tag. This is ideal for
location-based chat (rooms, zones, game tables, "currently in" channels):

```ts
chat.addChannel('room:tavern', { tag: 'room' });
chat.addChannel('room:forge', { tag: 'room' });

chat.userJoinChannel('u1', 'room:tavern');
chat.userJoinChannel('u1', 'room:forge'); // u1 automatically leaves room:tavern
```

Untagged channels (`general`, `trade`, …) are not affected, so a user can be in many global
channels and exactly one room at a time.

### Ephemeral and persistent channels

By default, a channel is **removed automatically when its last user leaves** (or is kicked):
perfect for on-the-fly channels (a party, a duel, a private conversation). Make a channel
`persistent` to keep it alive while empty:

```ts
chat.addChannel('general', { persistent: true });

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
chat.addChannel('staff', { hidden: true });

chat.getChannelList().map((c) => c.id); // 'staff' is not listed
```

### Colors

Each presence carries a free-form `color` string, so a user can have a different color per
channel. txat stores it and includes it in event payloads; your display decides what it means
(CSS color, ANSI code, palette index…).

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

### Using a channel on its own

A `Channel` works without a `System`, and its `events` emitter emits the same events with the
same payloads. Use it when you need a single room and no user registry; tags and automatic
removal are `System` features.

```ts
import { Channel, POWERS, TXAT_EVENTS } from '@laboralphy/o876-txat';

const room = new Channel('room');
room.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, message }) => send(recv, message));
room.addUser('u1', { name: 'Alice', powers: [POWERS.READ, POWERS.WRITE] });
room.postMessage('u1', 'alone here');
```

## Errors

txat prefers a loud error to a silent no-op. Every error it throws is a `TxatError` (a subclass
of `Error`) with a `code` from `TXAT_ERRORS`:

| `TXAT_ERRORS`             | Thrown by                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| `USER_NOT_FOUND`          | any `System` call naming an unregistered user                             |
| `USER_ALREADY_REGISTERED` | `registerUser`                                                            |
| `CHANNEL_NOT_FOUND`       | any `System` call naming an unknown channel                               |
| `CHANNEL_ALREADY_EXISTS`  | `addChannel`                                                              |
| `USER_ALREADY_ON_CHANNEL` | `userJoinChannel`                                                         |
| `ACCESS_DENIED`           | `userJoinChannel` / `addUser`: banned, or not on a private channel's list |
| `USER_NOT_ON_CHANNEL`     | `userLeaveChannel`, `removeUser`, `kick`, `postMessage`                   |
| `WRITE_DENIED`            | `postMessage` without `WRITE` power                                       |

```ts
import { TxatError, TXAT_ERRORS } from '@laboralphy/o876-txat';

try {
    chat.postMessage(idUser, idChannel, text);
} catch (e) {
    if (e instanceof TxatError && e.code === TXAT_ERRORS.WRITE_DENIED) {
        send(idUser, { type: 'notice', text: 'You are muted on this channel.' });
    } else {
        throw e;
    }
}
```

## API overview

### `System`

| Member                                    | Description                                                     |
| ----------------------------------------- | --------------------------------------------------------------- |
| `events`                                  | Typed emitter of all `TXAT_EVENTS`                              |
| `registerUser(id, name?)`                 | Register a user (name defaults to id)                           |
| `unregisterUser(id)`                      | Leave all channels and forget the user                          |
| `isUserRegistered(id)`                    | `boolean`                                                       |
| `getUser(id)`                             | `User`                                                          |
| `addChannel(id, options?)`                | Create a channel, see channel options below                     |
| `removeChannel(id)`                       | Close and forget a channel                                      |
| `isChannelExists(id)`                     | `boolean`                                                       |
| `getChannel(id)`                          | `Channel`                                                       |
| `getChannelList()`                        | All channels except `HIDDEN` ones                               |
| `userJoinChannel(idUser, idChannel)`      | Join with default powers, leaving any channel with the same tag |
| `userLeaveChannel(idUser, idChannel)`     | Leave a channel                                                 |
| `postMessage(idUser, idChannel, content)` | Post a message, returns the `Message`                           |

### Channel options

`addChannel(id, options)` and `new Channel(id, options)` accept:

| Option          | Default         | Description                                     |
| --------------- | --------------- | ----------------------------------------------- |
| `tag`           | `''`            | Exclusivity tag: one channel per tag for a user |
| `persistent`    | `false`         | Keep the channel when its last user leaves      |
| `hidden`        | `false`         | Leave the channel out of `getChannelList()`     |
| `maxLines`      | `1000`          | Number of messages kept in history              |
| `defaultPowers` | `[READ, WRITE]` | Powers granted to joining users                 |

### `Channel`

| Member                                | Description                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `id`, `tag`                           | Identifier and optional exclusivity tag                                       |
| `events`                              | Typed emitter of this channel's events                                        |
| `users`                               | Present users, as `UserPresence[]`                                            |
| `getUser(idUser)`                     | `UserPresence \| undefined`                                                   |
| `addUser(idUser, { powers?, name? })` | Add a user (no tag handling); powers default to `defaultPowers`               |
| `removeUser(idUser, reason?)`         | Remove a user                                                                 |
| `kick(idUser)`                        | Remove a user with a `kicked` reason                                          |
| `ban(idUser)`, `unban(idUser)`        | Change the black list, kicking the user if present                            |
| `allow(idUser)`, `disallow(…)`        | Change the white list, kicking users who lose access                          |
| `whiteList`, `blackList`              | `ReadonlySet<string>` of user ids                                             |
| `private`                             | `true` when the white list is not empty                                       |
| `isAllowed(idUser)`                   | Whether the user may join, according to the access lists                      |
| `postMessage(idUser, content)`        | Post a message, returns the `Message`                                         |
| `maxLines`                            | History size; lowering it trims the history                                   |
| `defaultPowers`                       | `Set<POWERS>` granted to joining users                                        |
| `getMessages()`                       | Copy of the history, oldest first                                             |
| `attributes`                          | `Set<CHANNEL_ATTRIBUTES>`: `PERSISTENT`, `HIDDEN`; can be changed at any time |

### `UserPresence`

| Member                          | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `id`, `name`                    | User id and display name                      |
| `grant(power)`, `revoke(power)` | Chainable power changes, emit `POWER_CHANGED` |
| `hasPower(power)`               | `boolean`                                     |
| `powers`                        | Granted powers, as `POWERS[]`                 |
| `color`                         | Free-form string, `''` by default             |
| `toJSON()`                      | Plain snapshot: `{ id, name, color, powers }` |

### Enums

All enums are string enums, so their values stay readable once serialized or stored.

| Enum                 | Values                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POWERS`             | `READ` `'read'`, `WRITE` `'write'`, `MODERATE` `'moderate'`                                                   |
| `CHANNEL_ATTRIBUTES` | `PERSISTENT` `'persistent'`, `HIDDEN` `'hidden'`                                                              |
| `LEAVE_REASONS`      | `LEFT` `'left'`, `KICKED` `'kicked'`                                                                          |
| `TXAT_EVENTS`        | `'message.post'`, `'you.joined'`, `'you.left'`, `'user.joined'`, `'user.left'`, `'closed'`, `'power.changed'` |
| `TXAT_ERRORS`        | see [Errors](#errors)                                                                                         |

## Limitations

- **In memory only.** Restarting your process clears everything; persist what you need from the
  events.
- **No transport, no formatting.** By design: txat decides _who_ gets _what_, you deliver it.

## Upgrading from 1.x

Version 2 is a full TypeScript rewrite with a new API. The last JavaScript version remains
available as [release 1.3.2](https://github.com/Laboralphy/o876-txat/releases/tag/1.3.2) but is no
longer maintained.

## License

ISC © Raphaël Marandet
