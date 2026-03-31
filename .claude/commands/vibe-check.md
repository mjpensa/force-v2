Start the server if not running, open Safari to localhost:3000, and take screenshots to verify the current state of the app.

1. Check if server is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
2. If not running, start it: `node server.js &`
3. Open Safari: `osascript -e 'tell application "Safari" to open location "http://localhost:3000"'`
4. Wait 2 seconds, activate Safari, take screenshot
5. If a sessionId exists from a previous generation, navigate to the viewer and screenshot each view

Report what you see — any visual issues, layout problems, or broken states.

If the user provides specific feedback (e.g., "$ARGUMENTS"), address it directly.
