{Hook}      = require 'hook.io'
url         = require 'url'
querystring = require 'querystring'
fs          = require 'fs'

hook = undefined

listen = (eventname, options, req, res) ->
  # EventEmitter2 BUG workaround
  respond = (data) ->
    res.writeHead 200,
      'Content-Type' : 'application/json'
      'Hookio-Event' : @event
    res.end JSON.stringify(data)

    hook.off eventname, respond

  hook.on eventname, respond

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

    hook.emit eventname, data
    res.end()

module.exports = ->
  hook = new Hook
    name  : 'rest'
    debug : true

  hook.start()

  return (req, res) ->
    if req.method is 'OPTIONS'
      res.writeHead 200,
        'Access-Control-Allow-Origin'  : '*'
        'Access-Control-Allow-Methods' : 'GET, POST, PUT'
        'Access-Control-Allow-Headers' : 'Content-Type'

      return res.end()

    if req.url is '/client.js'
      location = req.headers.host + req.originalUrl.match(/.*\//)

      res.write "window.hook_address = '#{location}';"
      fs.readFile 'browser/browser.js', (err, content) -> res.end content

      return

    {pathname, query} = url.parse(req.url)
    eventname = pathname.split('/')
                        .filter( (x) -> x.length > 0 )
                        .join('::')
    options = querystring.parse(query)

    switch req.method
      when 'GET'  then listen(eventname, options, req, res)
      when 'POST' then emit(eventname, options, req, res)
