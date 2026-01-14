---
trigger: always_on
---

- all file names are kebab case
- classes are defined as ES6 classes
- public properties are defined using getter/setter notation
- all class dependencies are parameters of the class ctor
- viewmodel classes are called VmViewModelName the files
- viewmodel file names are viewmodels/view-model-name.js
- service classes are called SrvServiceName
- service file names are services/service-name.js
- model classes are calles MdlModelName
- model file names are models/model-name.js
- do not use window reference in classes
- implement all events via alpine mechanisms