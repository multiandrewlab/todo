# Voice Input for Task Creation

## Summary

Add press-and-hold voice input to NLInputBar. Audio is recorded via MediaRecorder, transcribed by Cloudflare Workers AI Whisper, then fed through the existing NL parse pipeline to create a task with extracted fields.

## Interaction

- Mic icon button added to NLInputBar, next to the submit button
- Press-and-hold to record; release to stop and submit
- Minimum hold: 300ms (prevents accidental taps)
- States: idle (gray mic), recording (red pulsing mic, "Listening..."), transcribing (spinner, "Transcribing...")

## Data Flow

```
pointerdown → MediaRecorder starts (webm/opus)
pointerup   → stop recording → POST /api/v1/ai/transcribe (audio blob)
           → Whisper returns text → POST /api/v1/ai/parse (existing)
           → parsed result opens TaskModal with pre-filled fields
```

## Backend

New endpoint in existing `backend/src/routes/ai.ts`:

**POST /api/v1/ai/transcribe**
- Input: multipart/form-data with `audio` file
- Validation: authenticated user, max 10MB file size
- Calls: `env.AI.run('@cf/openai/whisper', { audio: arrayBuffer })`
- Returns: `{ text: string }`

## Frontend

Changes to `NLInputBar.vue`:
- MediaRecorder logic with `getUserMedia({ audio: true })`
- Reactive state: `isRecording`, `isTranscribing`
- Mic button with `pointerdown`/`pointerup` handlers
- After transcription, feed text into existing `parseText()` flow
- Hide mic button if MediaRecorder not supported

## Error Handling

- Permission denied: show message "Microphone access needed for voice input"
- Transcription failure: show error, no state lost
- Empty transcription: ignore silently
- No MediaRecorder support: hide mic button

## Testing

- Backend: unit test for transcribe endpoint (mock Workers AI)
- Frontend: component test for mic button visibility based on MediaRecorder support
