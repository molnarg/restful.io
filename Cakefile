class Batch
  fs            = require 'fs'
  {print}       = require 'sys'
  {spawn, exec} = require 'child_process'

  onFileChange = (file, callback) ->
    fs.watchFile file, (curr, prev) ->
      if curr.mtime.getTime() != prev.mtime.getTime()
        callback?()

  constructor : ({@name, @dir, @join, @bundle, @coffee, @executable}) ->
    @dir or= ''
    @join and= @dir + @join
    @executable and= @dir + @executable
    @coffee = @coffee.map (name) => @dir + name + '.coffee'

  watch : (callback) ->
    for sourcefile in @coffee
      onFileChange sourcefile, callback

  compile : (callback) ->
    print "#{@name} : Compiling...\n"

    arguments = ['--compile']
    .concat(if @join? then ['--join', @join] else [])
    .concat(if @bare? then ['--bare'] else [])
    .concat(@coffee)

    coffee = spawn 'coffee', arguments
    coffee.stdout.on 'data', (data) -> print data.toString()
    coffee.stderr.on 'data', (data) -> print data.toString()
    coffee.on 'exit', (status) -> callback?() if status is 0

  run : (callback) ->
    return if not @executable?

    console.log "#{@name} : Running #{@executable}"

    # Kill running instance first if any
    if @process?
      @process.kill()

    # Run a new instance
    @process = spawn @executable
    @process.stdout.on 'data', (data) -> print data.toString()
    @process.stderr.on 'data', (data) -> print data.toString()
    @process.on 'exit', (status) -> callback?() if status is 0

batches = []

batches.push new Batch
  name       : 'Server files'
  dir        : 'lib/'
  coffee     : ['middleware']
  executable : '../bin/server'

batches.push new Batch
  name   : 'Browser files'
  dir    : 'browser/'
  join   : 'browser.js'
  coffee : ['browser']

task 'build', 'Compile CoffeeScript source files', ->
  batches.map (batch) ->
    batch.compile()

task 'watch', 'Recompile CoffeeScript source files when modified', ->
  batches.map (batch) ->
    batch.compile()
    batch.watch -> batch.compile()

task 'watch_and_run', 'Recompile CoffeeScript source files when modified, and run batches which have an executable specified.', ->
  batches.map (batch) ->
    batch.compile -> batch.run()
    batch.watch -> batch.compile -> batch.run()
