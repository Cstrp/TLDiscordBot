# TLStatusBot

**TLDiscordBot** is a Discord bot that monitors the server statuses of *Throne and Liberty*. The bot allows players to stay updated on the availability of game servers, helping them avoid interruptions and ensure they’re always connected.

## Features

1. **Manual Server Status Check:**
   Any day of the week, users can use the `/check` command to get real-time updates on the server statuses of *Throne and Liberty*. The bot checks and reports the server’s current status (whether online, in maintenance, or experiencing issues).

2. **Automated Thursday Checks:**
   Every Thursday, on the day of technical maintenance, the bot autonomously checks the server statuses throughout the day. It sends regular updates and notifications directly to a specified Discord channel, keeping players informed of any downtime or issues.

### Installation

To run TLDiscordBot locally, follow these steps:

1. Clone the repository:

```bash
  # Clone remote repository
  git clone https://github.com/cstrp/TLDiscordBot.git

  # Change directory
  cd TLDiscordBot

  # Install deps
  npm install

  # Run the app
  npm run start:dev
```

### Configuration

You can configure the bot's behavior through the .env file. The bot currently requires the following environment variables:

> See .env.example

Make sure these are correctly set in the .env file for the bot to function properly.

### Usage

- To check server status manually:
    Type the /check command in any Discord channel where the bot is present. The bot will respond with the current status of the Throne and Liberty servers, including any maintenance periods or downtime.

- Automated notifications (every Thursday):
    On Thursdays, the bot will automatically check the server status and send updates to the designated Discord channel throughout the day. You don't need to trigger any commands for these notifications—they will be sent automatically.
