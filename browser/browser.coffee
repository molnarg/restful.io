
class Hook extends EventEmitter2
  constructor : (@base_url) ->

window.hook = new Hook(window.hook_address)
