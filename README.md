# O876 TXAT


## Classes

### TxatManager

This class acts as a front-class providing method to controls all other chat sub classes.


### Channel

A channel gather all user that wish to talk about a specific topic.


### Message

A message sent by a user.
Can be public or private. Public messages are sent to all users connected to a channel.
Private messages are sent to only one user.

#### Properties

- __content__ {string} : Message content
- __sender__ {User} : User who sent this message
- __timestamp__ {integet} : When this message has been sent.


### User

A user connected to chat manager.
This class holds all information about a user.

#### Properties

- __id__ {string} : user identifier
- __name__ {string} : user display name
- __connected__ {boolean} : true if user is currently connected
- __data__ {object} : a simple objet to hold data

### Ban

A user may be banned from a channel, this prevents them to joined the channel again.
This is a functionnality used to expel user that infringe channel rules of conduct.
This class holds all data about a ban.

#### Properties

- __user__ {User} : instance of banned user
- __reason__ {string} : The reason why this user is banned
- __until__ {Date} : Date time when user will be able to come back to channel
- __permanent__ {boolean} : If true the ban is permanent, and the user can never go back to the channel unless a moderator cancels the ban.
- __banner__ {User} : Instance of user who has created the ban.

## Events from TxatManager

### EVENT_CHANNEL_MESSAGE

Type: Communication event
This event is sent to all users connected to the channel.

- __recipient__ {string} : Id of user whose message must be sent.
- __channel__ {Channel} : channel on which the message is being sent.
- __message__ {Message} : message composed by the speaking user.

### EVENT_USER_BANNED

Type: Communication event
This event is an information about a user being banned from a channel.

- __recipient__ {string} : Id of user whose message must be sent - this is NOT the banned user instance.
- __channel__ {Channel} : channel from which the user is banned.
- __ban__ {Ban} : all information about the ban (see class Ban).

### EVENT_USER_UNBANNED

Type: Communication event
This event is an information about a user ban being cancelled.

- __recipient__ {string} : Id of recipient whose message must be delivered - this is NOT the banned user instance.
- __user__ {User} : instance of user being unbanned.
- __channel__ {Channel} : channel from which the user was banned, and now unbanned.

### EVENT_USER_JOINED_CHANNEL

Type: Communication event
This event is sent when a user joins a channel.

- __recipient__ {string} : Id of recipient whose message must be delivered.
- __channel__ {Channel} : channel joined by user.
- __user__ {User} : Instance of user joining the channel.

### EVENT_USER_LEFT_CHANNEL

Type: Communication event
This event is sent when a user leaves a channel.

- __recipient__ {string} : Id of recipient whose message must be delivered.
- __channel__ {Channel} : channel left by user.
- __user__ {User} : Instance of user leaving the channel.

### EVENT_USER_INVITED

Type: Communication event
Event sent when a channel moderator, admin, or host, invites a user to join the channel.
The user joins immediatly the channel.

- __recipient__ {string} : Id of recipient whose message must be delivered
- __channel__ {Channel} : Instance of channel which user is invited to.
- __user__ {User} : Invited user instance.

### EVENT_USER_INSUFFICIENT_CAPABILITY

Type: Technical event
This event is fired when a user cannot use functionality.
This is because use has not a sufficient rank to use a specific command.
Ex: a user with rank : USER_RANK_CHATTER will fire this event if it tries to change topic, or ban another user.

- __user__ {User} : Instance of user who tries to use functionality
- __capability__ {string} : capability in cause
- __channel__ {Channel} : channel where user is trying to use functionality

### EVENT_CHANNEL_CREATED

Type: Technical event
This event is fired when a new channel is created.

- __channel__ {Channel} : instance of new channel

### EVENT_CHANNEL_DESTROYED

Type: Technical event
This event is fired when a channel is destroyed.

- __channel__ {Channel} : instance of channel being destroyed

### EVENT_USER_RECEIVE_PRIVATE_MESSAGE

Type: Communication event
This event is fired when a user sends a message directly to another user.

- __recipient__ {string} : id of user whose message is sent
- __message__ {Message} : Message composed.

### EVENT_USER_CONNECTED

This event is fired when a user connects to the chat system.

- __user__ {User} : instance of user newly connected

### EVENT_USER_DISCONNECTED

This event is fired when a user disconnects from the chat system.

- __user__ {User} : instance of user disconnection from server
