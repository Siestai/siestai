# Connect VPS

Connect to the project VPS over SSH. Reads credentials from `.env.claude` in the project root.

## Instructions

1. Read `.env.claude` from the project root and extract `VPS_IP` and `VPS_PASSWORD`.
2. Use `expect` to SSH in as `root` and run a status summary:
   - `whoami && hostname && df -h / && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
3. Show the output to the user, then ask what they'd like to do on the server.
4. For subsequent commands the user requests, use `expect` to SSH in, run the command, and show the output.

## Bash template

```bash
expect << 'EXPECT_SCRIPT'
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@$VPS_IP
expect "password:"
send "$VPS_PASSWORD\r"
expect -re {#\s*$}
send "COMMAND_HERE\r"
expect -re {#\s*$}
send "exit\r"
expect eof
EXPECT_SCRIPT
```

Replace `$VPS_IP` and `$VPS_PASSWORD` with the values read from `.env.claude`.
