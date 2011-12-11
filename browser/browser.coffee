# CoupledEventEmitter2
# Returns the more general event which shadows the other
selectMoreGeneral = (event1, event2) ->
  return undefined if (event1.length != event2.length) \
                   or (event1.level  == event2.level)

  more_general = undefined

  for part1, index in event1.parts
    part2 = event2.parts[index]

    if part1 is '*' and part2 is '*'
      continue

    else if part1 is '*'
      return undefined if event2 is more_general
      more_general = event1

    else if part2 is '*'
      return undefined if event1 is more_general
      more_general = event2

    else if part1 != part2
      return undefined

  return more_general

insert = (new_event, tree) ->
  for event_name, event of tree
    more_general = selectMoreGeneral(new_event, event)

    if more_general is undefined
      continue

    else
      if new_event is more_general
        new_event.shadow[event_name] = event
        delete tree[event_name]

      else #if event is more_general
        return insert(new_event, event.shadow)

  tree[new_event.type] = new_event

  return tree

findAndRemove = (name_to_remove, tree) ->
  if name_to_remove of tree
    event = tree[name_to_remove]
    delete tree[name_to_remove]
    return {event: event, parent: tree}

  else
    for eventname, event of tree
      result = findAndRemove(name_to_remove, event.shadow)
      return result if result isnt undefined

    return undefined

countListeners = (type, tree) ->
  if type.length isnt 0
    if type[0] of tree
      countListeners type.slice(1), tree[type[0]]
    else
      0
  else
    if not tree._listeners?
      0
    else if typeof tree._listeners is 'function'
      1
    else
      tree._listeners.length


class CoupledEventEmitter2 extends EventEmitter2
  addIncomingEvent = (type) ->
    event =
      type   : type
      parts  : parts = type.split(@delimiter)
      length : parts.length
      level  : parts.filter((x) -> x is '*').length
      shadow : {}

    parent = insert event, @_incoming

    if parent is @_incoming
      @emit 'enableIncoming', type

  removeIncomingEvent = (type) ->
    result = findAndRemove type, @_incoming
    return if result is undefined
    {event, parent} = result

    if parent is @_incoming
      @emit 'disableIncoming', type

    for shadowed_name, shadowed_event of event.shadow
      parent = insert shadowed_event, @_incoming
      if parent is @_incoming
        @emit 'enableIncoming', type

  constructor : (options) ->
    super(options)

    @_incoming = {}

    if options.wildcard
      template = (original_method, before, after, method) -> (type) ->
        c_before = countListeners(type.split(@delimiter), @listenerTree)

        value = EventEmitter2.prototype[original_method].apply(this, arguments)

        c_after = countListeners(type.split(@delimiter), @listenerTree)

        if (c_before == before or (before is undefined and c_before > 0)) and \
            c_after == after
          method.call(this, type) if type not in ['enableIncoming', 'disableIncoming']

        return value

      @on = template 'on', 0, 1, addIncomingEvent
      @off = template 'off', 1, 0, removeIncomingEvent
      @removeAllListeners = template 'removeAllListeners', undefined, 0, removeIncomingEvent
      @incomingEvents = -> type for type of @_incoming

    else
      template = (original_method, before, after, event) -> (type) ->
        exists_before = @_events[type]?

        value = EventEmitter2.prototype[original_method].apply(this, arguments)

        exists_after = @_events[type]?

        if exists_before == before and exists_after == after
          @emit(event, type)

        return value

      @on = template 'on', false, true, 'enableIncoming'
      @off = template 'off', true, false, 'disableIncoming'
      @removeAllListeners = template 'removeAllListeners', true, false, 'disableIncoming'
      @incomingEvents = -> type for type of @_events

########################################################
############## CoupledEventEmitter2 END ################

class ServerSentEvents extends EventEmitter2
  constructor : (@options) ->
    @living = @options.living ? true
    @start() if @living

  onmessage : (e) =>
    {type, event} = JSON.parse(e.data)
    @emit type, event

  start : =>
    @source = new EventSource(@options.url)

    @source.addEventListener 'message', @onmessage, false

  stop : =>
    @source.close()

class LongPoll extends EventEmitter2
  constructor : (@options) ->
    @living = @options.living ? true
    @start() if @living

  start : ->
    @living = true
    random = Math.floor(Math.random()*1000)
    @request = superagent('GET', @options.url)
    @request.set(name, value) for name, value of @options.headers
    @request.end (res) =>
      @emit(res.header['event'], res.body) if res.ok
      @start() if @living?

  stop : ->
    @living = false
    @request.xhr.abort()

newEventRequest = (options) ->
  if window.EventSource?
    return new ServerSentEvents(options)
  else
    return new LongPoll(options)

class Hook extends CoupledEventEmitter2
  forwardEvents = (from, to) ->
    from.onAny (data) ->
      console.log 'forwarding', this.event, data
      EventEmitter2.prototype.emit.call to, this.event, data

  create_url = (base_url, event, id) ->
    'http://' + base_url + event.split('::').join('/') + '?id=' + id

  constructor : (@base_url = window.hook_address) ->
    super
      wildcard : true
      delimiter : '::'
    @original_emit = CoupledEventEmitter2.prototype.emit

    @eventSources = {}

    @id = '' + Math.floor(Math.random()*1000000)

    @on 'enableIncoming',  @enable
    @on 'disableIncoming', @disable

  enable : (event) =>
    console.log 'enable', event
    return console.log 'bug, listening to event twice' if @eventSources[event]?

    @eventSources[event] = newEventRequest
      url     : create_url @base_url, event, @id
      living  : true

    forwardEvents @eventSources[event], this

  disable : (event) =>
    console.log 'disable', event.name
    return console.log 'bug, deleting none existing poll' if not @eventSources[event]?

    @eventSources[event].stop()
    delete @eventSources[event]

  emit : (event, data, callback) =>
    if event in ['newListener', 'enableIncoming', 'disableIncoming']
      return @original_emit event, data, callback

    console.log 'sending', event, data
    return console.log('no data') if not data?

    method = if callback? then 'put' else 'post'
    url = create_url @base_url, event, @id

    superagent(method, url)
      .data(JSON.stringify(data))
      .end( -> console.log 'sending', event, data, 'success')

    @original_emit event, data, callback

window.Hook = Hook

document.cookie = "id=" + Math.floor(Math.random()*1000000) + "; path=/";

