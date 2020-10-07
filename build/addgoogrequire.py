"""Creates a build from the given commands.
 
 To upgrade closure compiler to v20200719, references with goog.require and
 goog.requireType are required for all files. This script reads the log of 
 build/all.py, and adds the missing references to the files.

 In command line, run:
   build/all.py &> build/compilerupgradeoutput.txt
   python build/addgooglerequire.py
"""

import os


outputFile = open('build/compilerupgradeoutput.txt', 'r')
lines = outputFile.readlines()

fileName = None
references = []
toAdd = ''
requires = []
requireTypes = []
require = ''
ref = ''
hasProvide = False
resStr = ''

for line in lines:
  if line.startswith('/google/code/'):
    # Read the current file name.
    fileNameIndex = line.index(':')
    currentFileName = line[0: fileNameIndex]
    if fileName == None:
      fileName = currentFileName

    # If we see a new file name, add the missing google.require for the previous
    # file.
    if currentFileName != fileName and (len(requires) or len(requireTypes)):
      newRequireTypes = []
      for ref in requireTypes:
        if ref not in requires:
          newRequireTypes.append(ref) 

      requireTypes = newRequireTypes
      
      requires = sorted(requires)
      for ref in requires:
        res = 'goog.require(\'' + ref + '\');\n'
        resStr += res
      
      requireTypes = sorted(requireTypes)
      for ref in requireTypes:
        res = 'goog.requireType(\'' + ref + '\');\n'
        resStr += res 
      resStr += '\n'
      print(currentFileName)
      print(resStr)
      
      # Read the js file, and find the line to insert the references.
      with open(fileName, 'r') as jsFile:
        contents = jsFile.readlines()
        # First five lines are comments.
        linenumber = 5
        lastline = ''
        for c in contents[5:]:
          # Insert goog.require after goog.provide.
          if c.startswith('goog.provide') or c.startswith('goog.require') or\
          not c.strip():
            if lastline.startswith('goog.require') and not c.strip():
              break
            linenumber += 1
            if c.startswith('goog.provide'):
              hasProvide = True
            lastline = c  
          else:
            break

      # Write into the js file.
      with open(fileName, 'w') as jsFile:
        if hasProvide:
          contents.insert(linenumber, '\n')
          linenumber += 1
        contents.insert(linenumber, resStr)
        jsFile.writelines(contents)

      references = []
      requires = []
      requireTypes = []
      fileName = currentFileName
      hasProvide = False
      resStr = ''

    # Read the reference.
    refLeft = line.find("'") + 1
    refRight = line.find("'", refLeft)
    ref = line[refLeft:refRight]

    # if ref not in references:
    #  references.append(ref)

  # Read the prefix.
  elif line.find('goog.requireType') >= 0:
    # requirePrefix = 'goog.requireType'
    if ref not in requireTypes:
      requireTypes.append(ref)
  elif line.find('goog.require.') >= 0:
    # print 'require'
    # requirePrefix = 'goog.require'
    if ref not in requires:
      requires.append(ref)

# print count
outputFile.close()