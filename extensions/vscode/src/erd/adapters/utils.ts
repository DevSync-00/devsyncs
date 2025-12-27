/**
 * Fixes common JSON issues in ChartDB smart-query output.
 * Based on ChartDB's fixMetadataJson utility.
 */
export function fixMetadataJson(metadataJson: string): string {
  // Replace problematic array default values with null
  metadataJson = metadataJson.replace(
    /"default": "?'?\[[^\]]*\]'?"?(\\")?(,|\})/gs,
    '"default": null$2',
  )

  // Generic fix for all default values with '\ pattern - convert to just '
  metadataJson = metadataJson.replace(
    /"default":\s*"(.*?)'\\"(,|\})/g,
    '"default": "$1"$2',
  )

  return (
    metadataJson
      .trim()
      // First unescape the JSON string
      .replace(/\\n/g, '') // Remove literal \n (backslash + n) from stringified JSON
      .replace(/\\t/g, '') // Remove literal \t (backslash + t) from stringified JSON
      .replace(/\\r/g, '') // Remove literal \r (backslash + r) from stringified JSON
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/^[^{]*/, '') // Remove everything before the first '{'
      .replace(/}[^}]*$/, '}') // Remove everything after the last '}'
      .replace(/: ""([^"]*)""/g, ': "$1"') // Convert : ""value"" to : "value"
      .replace(/:""([^"]*)""/g, ':"$1"') // Convert :""value"" to :"value" (no space variant)
      .replace(/""(\w+)""/g, '"$1"') // Convert ""key"" to "key"
      .replace(/^\s+|\s+$/g, '')
      .replace(/^"|"$/g, '')
      .replace(/^'|'$/g, '')
      .replace(/""""/g, '""') // Remove Quadruple quotes from keys
      .replace(/"""([^",}]+)"""/g, '"$1"') // Remove tripple quotes from keys
      .replace(/""([^",}]+)""/g, '"$1"') // Remove double quotes from keys
      .replace(/'"([^"]+)"'/g, '\\"$1\\"') // Replace single-quoted double quotes
      .replace(/'(".*?")'/g, "'\\$1'") // Handle cases like '"{}"'::json
      // Handle specific case for nextval with quoted identifiers
      .replace(/nextval\('(".*?")'::regclass\)/g, "nextval('\\$1'::regclass)")
      // Handle cases like "'CHAT'::"CustomType"" (ensures existing quotes are escaped for JSON)
      .replace(/'([^']+)'::\"([^\"]+)\"/g, "'$1'::\\\"$2\\\"")
      // Convert string "null" to actual null for precision field
      .replace(/"precision": "null"/g, '"precision": null')
      // Convert string "true"/"false" to actual boolean for nullable field
      .replace(/"nullable": "false"/g, '"nullable": false')
      .replace(/"nullable": "true"/g, '"nullable": true')
      .replace(/\"/g, '___ESCAPED_QUOTE___') // Temporarily replace empty strings
      .replace(/(?<=:\s*)""(?=\s*[,}])/g, '___EMPTY___') // Temporarily replace empty strings
      .replace(/""/g, '"') // Replace remaining double quotes
      .replace(/___ESCAPED_QUOTE___/g, '"') // Restore empty strings
      .replace(/___EMPTY___/g, '""') // Restore empty strings
      .replace(/\n/g, '')
  )
}

