# Energio

![Energ.io image](./static/images/big-logo.png)

## What is this?

This is a multiplayer strategy .io game, in which each player is an empire, which is fighting with the other empires (aka players) for control over the galaxy, in order to explit it for its energy.

In this game, there are two recources: energy and people. The people are used to colonise other planets, and they produce energy, the second recource. Energy is not a collectable resource thou, rather, the energy is measured in watts, aka how much are you producing. This means that ahything you do will consume some of this energy, so you've got to be really careful about how you spend your energy in the game. If you lose all of your energy producers, you lose the game as well.

## How to use?

First, you'll need the following installed:
- nodejs
- npm
- yarn (globally)

Supposing you're in a terminal, execute the following:

```sh
# Clone the repository
git clone https://www.github.com/TopchetoEU/energio.git
# Go in the repo folder
cd energio
# Install all packages, needed to execute the project
yarn install
```

Now that you've done that, open static/serverip.txt in your favourite editor and edit it so it includes only your server's ip (just the ip, like this: `1.2.3.4` or `my.domain.net`)

After doing that, execute the following commands:

```sh
# Build for production
gulp prod
# Start the server
node build/server/server.js
```

You are required to have ports `80` and `8002` open for the server to work.

## Usage for basic users

You should provide your users with the ip of your servers. They will join it like a regular website.

## Developing the project

Use the following command:

```sh
gulp devel
```

to start a watch-mode development building. Then, enter the webpage as a client (note that the client won't refresh if it recompiles). You can see typescript source in the browser with F12, due to the configured source mappings. It is recommended that you don't run your server in development mode,

### Used technologies

This project is based on almost no technologies, but still, it uses the following ones:
- Typescript
- WebSockets (for communication server-client)
- Gulp (for building projects)
- Yarn (as a package manager)
- Node (for hosting of the server)

### Authors
- **Kaloyan Venkov** - *main and only programmer* - [TopchetoEU](https://www.github.com/TopchetoEU)
- **Stilyan Mandaliev** - *help with extra work* (doesn't have Github)
- **Lyubomir Milev** - *artwork* (doesn't have Github)
- **Martin Radnev** - *music and sound effects* (doesn't have Github)
- **Rosen Marinov** - *presentation and management* (doesn't have Github)
