# Development Guide

Track ideas and explanations to decisions.

## App.js

- function App()
- export default App;

## src/utils/storage.js

- `const` means constant reference
- `STORAGE_KEYS` are the unique string identifiers to store data
- `storage` essentially contains the 'how-to' talk to browser
- `return data ? JSON.parse(data) : null;`
    - `condition ? value_if_true : value_if_false`
    - Ternary operator; makes an if-else in a single line
    - `data` is the condition = does variable data have anything in it?
    - `?` = "Then do this..."
    - data is likely an array or object, `JSON.parse` turns that text
    back into a JS object to be used
    - `null` = if there is nothing in data
