const debug = require('debug')('brandable_css')
import {writeFileAsync, readJsonAsync} from 'fs-extra-promise'
import {paths as PATHS} from './config'

export default async function writeDefaultBrandableVariablesScss () {
  debug('writing', PATHS.brandable_variables_defaults_scss)
  let fileContents = '// THIS FILE IS AUTOGENERATED by `brandable_css`. Make changes to: ' + PATHS.brandable_variables_json
  let variableGrous = await readJsonAsync(PATHS.brandable_variables_json)
  variableGrous.forEach(variableGroup => {
    variableGroup.variables.forEach(variable => {
      let value = variable.default
      if (variable.type === 'image') value = `url("${value}")`
      fileContents += `\n$${variable.variable_name}: ${value} !default;`
    })
  })
  return await writeFileAsync(PATHS.brandable_variables_defaults_scss, fileContents)
}
