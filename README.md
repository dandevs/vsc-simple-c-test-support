# Simple C Tester Support

A VS Code extension that writes all editor source breakpoints to a local JSON file whenever breakpoints change.

## Features

- Auto-writes breakpoints on startup and on every breakpoint add/remove/change
- Saves to a configurable folder (default: `test_build/breakpoints.json`)
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
| `breakpointServer.outputFolderPath` | `test_build` | Relative output folder (file is always named `breakpoints.json`) |

### Example `settings.json`

```json
{
  "breakpointServer.outputFolderPath": "build/debug"
}
```

### Folder rules

- Must be a relative path
- Must not escape workspace root (`..` segments are rejected)
- The output file is always named `breakpoints.json` within this folder
- Invalid values automatically fall back to `test_build`

## Behavior notes

- The extension uses the first workspace folder as its root
- The file is only written if the configured folder exists **and** contains a `db.json` file (acts as a sentinel)
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
