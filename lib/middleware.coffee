{Hook}         = require 'hook.io'
url            = require 'url'
querystring    = require 'querystring'
fs             = require 'fs'
{EventEmitter} = require 'events'
EventChannel   = require './eventchannel'

hook = undefined

emit_id = undefined

listen = (eventname, options, req, res) ->
  event_req = new EventChannel(req, res)

  respond = (data) ->
    #console.log 'checking identity', emit_id, options.id
    return if emit_id? and options.id? and emit_id == options.id

    event_req.emit this.event, data

  hook.on eventname, respond
  event_req.on 'end', -> hook.off eventname, respond

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

    emit_id = options.id ? undefined
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
    req.stat =
      start : new Date()
      stop  : undefined

    if req.method is 'OPTIONS'
      res.writeHead 200,
        'Access-Control-Allow-Origin' : '*'
        'Access-Control-Allow-Methods' : 'GET, POST, PUT'
        'Access-Control-Allow-Headers' : 'Content-Type, X-Requested-With'

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
