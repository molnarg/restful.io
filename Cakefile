fs            = require 'fs'
{print}       = require 'sys'
{spawn, exec} = require 'child_process'

source_files = []

# Server files
source_files.push
  name   : 'Server files'
  dir    : 'lib/'
  coffee : ['']

source_files = source_files.map (batch) ->
  dir = batch.dir ? ''
  name   : batch.name
  bare   : batch.bare
  join   : dir + batch.join if batch.join?
  coffee : batch.coffee.map (filename) -> dir + filename
  run    : dir + batch.run if batch.run?

# Compile a batch of coffee files
compile = (batch, callback) ->
  print "#{batch.name} : Compiling...\n"

  arguments = ['--compile']
  .concat(if batch.join? then ['--join', batch.join] else [])
  .concat(if batch.bare? then ['--bare'] else [])
  .concat(batch.coffee)

  coffee = spawn 'coffee', arguments
  coffee.stdout.on 'data', (data) -> print data.toString()
  coffee.stderr.on 'data', (data) -> print data.toString()
  coffee.on 'exit', (status) -> callback?(batch) if status is 0

# Watch a batch of coffee files
watch = (batch, callback) ->
  onFileChange = (file, callback) ->
    fs.watchFile file, (curr, prev) ->
      if curr.mtime.getTime() != prev.mtime.getTime()
        callback()

  for sourcefile in batch.coffee
    onFileChange sourcefile, -> compile(batch, callback)

task 'build', 'Compile CoffeeScript source files', ->
  for batch in source_files
    compile batch

task 'watch', 'Recompile CoffeeScript source files when modified', ->
  for batch in source_files
    compile batch
    watch batch
