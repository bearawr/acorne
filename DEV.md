# Development Guide

Track ideas and explanations to decisions.

## App.js

- function App()
- export default App;

## App.css
- `.app`
    - flex display

- `.main-content`
    - takes all space
    - has scrollbar

- has phone/mobile view

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

- Sleep data functions
    - getSleepData
    - saveSleepData
    - addSleepEntry
    - updateSleepEntry
    - deleteSleepEntry

- placeholder functions for other modules

## TO DO:
- change the color for sleep so it has its own color, separate from the primary brown colors.
- put the distributed sleep number indicator on top of the bar to the right, not within

## Changes to be made

- wanna change the school layout
    [x] when screen width is reduced, prioritize showing the title and checkbox
    [x] should be able to edit STATUS, PRIORITY, and DUE on click, not via the edit button
    [x] add border color left on task row that reflects the task's STATUS
    [x] change 1d to 1 day for deadline. note that includes 2d changed to 2 days
    [x] change the ellipses button on task row to expand lucide react icon. this button will show the Edit Task form like text editor.
        * [x] Task name on top, Subject under task name. Due Date and Deadline follows. PRIORITY and STATUS are displayed under. DESCRIPTION is the largest part of the modal which accepts
        * [x] no more Save button needed. Automatically save whatever changes were made.
    [x] default All view is Hide Done (default to hiding all dones on first open) (check)

    part 2 changes of school layout:
    [] make subtask onclick editable functions like the parent task (able to edit STATUS, PRIORITY, and DUE on click)
    [] at any point when the screen is being squeezed on desktop, the title of the task is always shown.
       so maybe that means when the screen is so small, the view is horizontally scrollable?
       so that everything can still be displayed. 

- overview Top 3 Focus or Queue needs to include the Hobbies and Fitness modules!!!
