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

  constructor : (@base_url = window.hook_address) ->
    super
      wildcard : true
      delimiter : '::'

  emit : (eventname, data, callback) ->
    url = create_url @base_url, eventname

    method = if callback? then 'put' else 'post'

    superagent(method, url).data(data).end()

  on : (eventname, callback) ->
    url = create_url @base_url, eventname

    superagent('GET', url).end (res) ->
      if res.ok
        callback res.body

window.Hook = Hook
