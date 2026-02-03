---
trigger: always_on
---

## Do's

- all file names are kebab case
- classes are defined as ES6 classes
- public reactive properties in viewmodels must be direct instance properties (not getter/setter) for Alpine.js reactivity compatibility
- computed/derived properties can use getter notation (e.g., `get formattedDate()`)
- all class dependencies are parameters of the class ctor (constructor parameter injection directly, no abstraction services)
- viewmodel classes are called VmViewModelName the files
- viewmodel file names are viewmodels/view-model-name.js
- service classes are called SrvServiceName
- service file names are services/service-name.js
- model classes are calles MdlModelName
- model file names are models/model-name.js
- implement all events via alpine mechanisms
- create html elements only in html files. always bind them to public properties of viewmodels.
- when a html element is dynamic, declare it statically in html and toggle its visibilty and data via bindings to a viewmodel.
- when DOM element access is necessary, use semantic methods from VmDom (add new methods there if not already available) instead of direct querySelector calls

## Dont's

- do not use window reference in classes
- do not make object globally available via reference augmentation on the window or the document object
- do not create html elements in viewmodels
- do not access public static members of other classes (resources and configuration should be injected via constructor)
- do not change array order in Alpine.js x-for loops (never remove/push items during editing—use x-show to hide instead)
