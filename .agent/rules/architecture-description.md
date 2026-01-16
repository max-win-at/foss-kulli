---
trigger: always_on
---

# App Architecture

## General

- SPA
- PWA
- MVVM pattern
- IoC
- Dependency Injection via ctor injection
- alpine.js
- Tailwind CSS
- Google Material Design

# IoC conventions

- Alpine.init is the main object resolution root. All instantiation happen there.
- app.js is the IoC container with Alpine.init logic and anonymous functions for lazy creation of objects

#MVVM pattern conventions

- alpine x-data objects are viewmodels
- viewmodels are classes
- view (html elements) are bound to public viewmodel properties
- view events are subscribed via x-on (or the @click*, @mouse*, @resize etc. shorthands) and forwared to viewmodel method calls.
- inputs are bound to viewmodel public properties
- all viewmodels implement the alpine init() method
- viewmodels are organized in component pattern; a root viewmodel can have serveral sub viewmodels, either in public lists (x-for) or in public properties
- alpine's template mechanism is used where lazyly create sub viewmodels are expected

# Dont's

- do not access public static members of other classes (resoures should have been injected)

## Specific

- storage backend will be localStorage abstracted into a localStorageRepository (repository pattern) for notes.
- VmWhiteBoard is the main applications viewmodel
- - search and about are bound to VmWhiteBoard
- - creation of visual sticky notes is bound to VmWhiteBoard's public property stickyNotes with VmStickyNote viewmodels (lazy factory methods)
- - VmWhiteBoard has a dependency to SrvLocalStorage for persistance and loading
