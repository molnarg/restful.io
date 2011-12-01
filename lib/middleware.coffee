{Hook}      = require 'hook.io'
url         = require 'url'
querystring = require 'querystring'
fs          = require 'fs'

hook = undefined

emit_id = undefined

listen = (eventname, options, req, res) ->
  respond = (data) ->
    return if (emit_id isnt undefined) and (emit_id == req.headers['hookio-id'])

    res.writeHead 200,
      'Content-Type'  : 'application/json'
      'Hookio-Event'  : @event
      'Hookio-Id'     : req.headers['hookio-id']
      'Cache-Control' : 'no-cache'

    res.end JSON.stringify(data)

    hook.off eventname, respond

    #req.stat.end = new Date()
    #console.log 'stat: ', req.method, req.url, req.stat.start, req.stat.end

  hook.on eventname, respond
  req.on 'close', -> hook.off eventname, respond

emit = (eventname, options, req, res) ->
  data = ''
  req.on 'data', (chunk) ->
    data += chunk.toString()

  req.on 'end', ->
    try
      data = JSON.parse data
    catch error
      res.statusCode = 400
      res.end "JSON parse error."
      return

    emit_id = req.headers['hookio-id']
    hook.emit eventname, data
    emit_id = undefined

    res.writeHead 200,
      'Cache-Control' : 'no-cache'
    res.end()

    #req.stat.end = new Date()
    #console.log 'stat: ', req.method, req.url, req.stat.start, req.stat.end

module.exports = (h) ->
  hook = h
  return (req, res, next) ->
    #req.stat =
    #  start : new Date()
    #  stop  : undefined

    if req.method is 'OPTIONS'
      res.writeHead 200,
        'Access-Control-Allow-Origin' : '*'
        'Access-Control-Allow-Methods' : 'GET, POST, PUT'
        'Access-Control-Allow-Headers' : 'Content-Type, Hookio-Id, X-Requested-With'

      return res.end()

    if req.url is '/client.js'
      location = req.headers.host + req.originalUrl.match(/.*\//)
      res.write "window.hook_address = '#{location}';"

      client_path = __dirname + '/../browser/browser.js'
      fs.readFile client_path, (err, content) -> res.end content

      return

    {pathname, query} = url.parse(req.url)
    eventname = pathname.split('/')
                        .filter( (x) -> x.length > 0 )
                        .join('::')
    options = querystring.parse(query)

    switch req.method
      when 'GET' then listen(eventname, options, req, res)
      when 'POST' then emit(eventname, options, req, res)
