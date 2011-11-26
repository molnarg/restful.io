class LongPoll
  constructor : (@url, @callback, @living = true) ->
    @start() if @living

  start : =>
    @living = true
    @request = superagent('GET', @url)
    @request.end (res) =>
      @callback res if res.ok
      @start() if @living?

  stop : =>
    @living = false
    @request.xhr.abort()

class EventListener extends EventEmitter2
  constructor : (@base_url, @event) ->
    url = 'http://' + @base_url + @event.join('/')

    @longpoll = new LongPoll url, (res) =>
      console.log 'emit', res.header['hookio-event'], res.body
      @emit res.header['hookio-event'], res.body

class Hook extends EventEmitter2
  create_url = (base_url, eventname, options) ->
    pathname = eventname.split('::')
                        .filter( (x) -> x.length > 0 )
                        .join('/')

    query = if options?
      '?' + ("#{name}=#{options[name]}" for name of options).join('&')
    else
      ''

    return 'http://' + base_url + pathname + query

  chain = ->
    functions = arguments
    return () -> (fn.apply(this, arguments) for fn in functions)[0]

  traverse = (node, process, route = []) ->
    for child_name of node
      continue if (child_name is '_listeners' or child_name is '_longpoll')

      cont = process subnode = node[child_name],
                     subroute = route.concat([child_name])

      if cont isnt false then traverse subnode, process, subroute

  forward_events = (from, to) ->
    from.onAny (data) ->
      EventEmitter2.prototype.emit.call to, this.event, data

  constructor : (@base_url = window.hook_address) ->
    super
      wildcard : true
      delimiter : '::'

    @longpolls = {}

    for fn in ['on', 'off', 'removeAllListeners']
      this[fn] = chain this[fn], @check_listeners

    @original_emit = @emit
    @emit = chain @original_emit, @send, @check_listeners

  check_listeners : =>
    check_node = (node, route = []) =>
      if node._listeners?
        if not node._longpoll?
          node._longpoll = new EventListener(@base_url, route)
          forward_events node._longpoll, this

          traverse node, (child) -> child._longpoll?.stop()

        # No need to go further in this subtree
        return false

      else #if not node._listeners?
        if node._longpoll?
          node._longpoll.stop()
          node._longpoll = undefined

          traverse node, (child) -> child._longpoll?.start()

    traverse @listenerTree, check_node

  listen : (event) =>
    return if event of @longpolls

    url = create_url @base_url, event

    console.log 'listening', event, url

    longpoll = =>
      @longpolls[event] = superagent('GET', url)
      @longpolls[event].end (res) =>
        if res.ok
          EventEmitter2.prototype.emit.call this, event, res.body

        # Continure polling if needed
        if @longpolls[event]?
          longpoll()
      return @longpolls[event]

    longpoll()

  stop_listening : (event) =>
    console.log 'stopped listening', event

    xhr = @longpolls[event].xhr
    delete @longpolls[event]
    xhr.abort()

  send : (event, data, callback) =>
    return if event is 'newListener'
    console.log 'sending', event, data
    return if not data?

    url = create_url @base_url, event

    method = if callback? then 'put' else 'post'

    superagent(method, url).data(data).end()

window.Hook = Hook
