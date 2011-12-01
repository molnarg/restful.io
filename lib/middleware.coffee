{Hook}         = require 'hook.io'
url            = require 'url'
querystring    = require 'querystring'
fs             = require 'fs'
{EventEmitter} = require 'events'

class ServerSentEvents extends EventEmitter
  constructor : (@req, @res) ->

  emit : (type, event) ->

class LongPoll extends EventEmitter
  constructor : (@req, @res) ->
    @req.on 'close', => EventEmitter.prototype.emit.call this, 'end'

    ###
    console.log 'longpoll:', @req.method, @req.url
    @on 'end', =>
      req.stat.end = new Date()
      console.log "stat: #{req.method} #{req.url}",
                  "#{req.stat.start.getHours()}:#{req.stat.start.getMinutes()}:#{req.stat.start.getSeconds()}", '-',
                  "#{req.stat.end.getHours()}:#{req.stat.end.getMinutes()}:#{req.stat.end.getSeconds()}"
    ###

  emit : (type, event) ->
    return super(type, event) if type is 'newListener'

    headers =
      'Hookio-Event'  : type
      'Hookio-Id'     : @req.headers['hookio-id']
      'Cache-Control' : 'no-cache'

    if typeof event is 'object' and event instanceof @req.__proto__.constructor
      # Shortcutting with another request, streaming content
      emitRequest = event

      headers['Content-Type'] = emitRequest.headers['Content-Type']
      @res.writeHead 200, headers

      emitRequest.on 'data', (chunk) =>
        @res.write chunk

      emitRequest.on 'end', =>
        @res.end()

    else
      # Regular event
      headers['Content-Type'] = 'application/json'
      @res.writeHead 200, headers

      @res.end JSON.stringify(event)

    EventEmitter.prototype.emit.call this, 'end'

class EventRequest
  constructor : (req, res) ->
    if req.headers.accept is 'text/event-stream'
      this.__proto__ = new ServerSentEvents(req, res)
    else
      this.__proto__ = new LongPoll(req, res)

hook = undefined

emit_id = undefined

listen = (eventname, options, req, res) ->
  event_req = new EventRequest(req, res)

  respond = (data) ->
    return if (emit_id isnt undefined) and (emit_id == req.headers['hookio-id'])

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
