# Simple C Tester Support

A VS Code extension that writes all editor source breakpoints to a local JSON file whenever breakpoints change.

## Features

- Auto-writes breakpoints on startup and on every breakpoint add/remove/change
- Saves to a configurable file path (default: `test_build/breakpoints.json`)
- Command Palette commands:
  - **Show Breakpoints Output** - opens the current breakpoint list in an untitled JSON file
  - **Write Breakpoints to File** - manually writes breakpoints immediately
- File output is normalized and stable:
  - `filepath` uses forward slashes (`/`) on every platform
  - `line_number` is 1-based
  - entries are sorted by filepath, then line number

## Output format

The generated file is a JSON array:

```json
[
  {
    "filepath": "/home/user/projects/app/src/main.c",
    "line_number": 42
  },
  {
    "filepath": "/home/user/projects/app/src/utils.c",
    "line_number": 15
  }
]
```

## Configuration

| Setting | Default | Description |
|---|---|---|
| `breakpointServer.outputPath` | `test_build/breakpoints.json` | Relative output file path from the first workspace folder |

### Example `settings.json`

```json
{
  "breakpointServer.outputPath": "build/debug/breakpoints.json"
}
```

### Path rules

- Must be a relative path
- Must not escape workspace root (`..` segments are rejected)
- Must include a file name (trailing slash is rejected)
- Invalid values automatically fall back to `test_build/breakpoints.json`

## Behavior notes

- The extension uses the first workspace folder as its root
- If no workspace is open, the extension does not write a file and shows a warning
- Writes are serialized internally to avoid race conditions when many breakpoint events fire quickly

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

### Run tests

```bash
npm run test
```

### Build `.vsix`

```bash
npm run build
```

## License

[MIT](LICENSE)
