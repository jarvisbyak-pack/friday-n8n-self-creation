# Friday — Web Voice UI

Premium React + Vite voice interface for the Friday n8n command layer.

## Web connection

The browser connects directly to the production Friday Core webhook:

`https://akpackfitness.app.n8n.cloud/webhook/friday-core`

The interface stores the selected webhook URL in browser local storage so no local configuration file is required.

The browser sends:
- `source`
- `message`
- `sessionId`
- `inputMode` (`text` or `voice`)

The UI accepts common n8n response shapes including `reply.text`, `reply`, `output`, and `text`.

## Browser requirements

- Modern browser with JavaScript enabled.
- Microphone permission is required for voice input.
- The n8n webhook must allow browser CORS requests.

No local environment file, local server configuration, or local webhook configuration is required by the web application.
