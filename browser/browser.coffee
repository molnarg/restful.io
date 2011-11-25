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
    return ->
      values = (fn.apply(this, arguments) for fn in functions)

      return values[0]

  constructor : (@base_url = window.hook_address) ->
    super
      wildcard : true
      delimiter : '::'

    @longpolls = {}

    for fn in ['on', 'off', 'removeAllListeners']
      this[fn] = chain this[fn], @check_listeners

    @emit = chain @emit, @check_listeners

    @onAny @send

  check_listeners : =>
    find_events = (tree, route = [], events = []) ->
      return find_events(tree.listenerTree, route, events) if tree.listenerTree?

      events.push route.join('::') if tree._listeners?

      for eventname of tree
        continue if eventname is '_listeners'
        find_events tree[eventname], route.concat([eventname]), events

      return events

    events = find_events(this)
    console.log 'checking listeners', (x for x of @longpolls), events

    for event of @longpolls
      if event not in events
        @stop_listening event

    for event in events
      if event not of @longpolls
        @listen event

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
    console.log 'sending', event, data
    return if not data?

    url = create_url @base_url, event

    method = if callback? then 'put' else 'post'

    superagent(method, url).data(data).end()

window.Hook = Hook
