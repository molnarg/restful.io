{Hook} = require 'hook.io'
url = require 'url'
querystring = require 'querystring'

hook = new Hook
  name  : 'rest'
  debug : true

hook.start()

listen = (eventname, options, req, res) ->
  hook.once eventname, (data) ->
    res.end JSON.stringify(data)

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

module.exports = -> (req, res) ->
  {pathname, query} = url.parse(req.url)
  eventname = pathname.split('/')
                      .filter( (x) -> x.length > 0 )
                      .join('::')
  options = querystring.parse(query)

  switch req.method
    when 'GET'  then listen(eventname, options, req, res)
    when 'POST' then emit(eventname, options, req, res)
