const fs = require("fs")
const solc = require('solc')
const path = require('path')
const web3 = require('web3')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const BEHAFABLE_NOTICE = "@notice OnBehalfable"
const BEHAFABLE_LIBRARY = "OnBehalfableLibrary.sol"

function crawlForInputs (folder, prefix, inputs) { 
  fs.readdirSync(folder).forEach(name => {
    const file = folder + "/" + name
    const stats = fs.statSync(file)

    if (stats.isDirectory())
    {
      crawlForInputs(file, prefix + name + "/", inputs)
    }
    else if (name.endsWith('.sol'))
    {
      inputs[prefix + name] = fs.readFileSync(file).toString()
    }
  })
}

function doesInherit(specifier, cls)
{
  for (const i in specifier.children)
  {
    const parent = specifier.children[i]
    if (parent.attributes.name == cls) 
    {
      return true
    }
  }
}

function injectProxyFunctions(contract_name, contract, source) 
{
  const func_map = {}
  let inject_point = 0
  for (const func of contract.children)
  {
    const attributes = func.attributes
    const func_name = attributes.name
    if (attributes && attributes.isConstructor == false && 
      attributes.documentation &&
      attributes.documentation.endsWith(BEHAFABLE_NOTICE) &&
      ['payable', 'nonpayable'].includes(attributes.stateMutability) &&
      attributes.visibility == 'public')
    {
      const input_variables = func.children[0].children
      let function_params = ""
      let function_sig = ""
      let function_call = ""
      for (const variable of input_variables) {
        if (function_params.length)
        {
          function_params += ", "
        }
        function_sig += ","
        if(function_call.length) 
        {
          function_call += ", "
        }
        function_params += variable.attributes.type + " " + variable.attributes.name
        function_sig += variable.attributes.type
        function_call += variable.attributes.name
      }
      console.log("Injecting: proxy_", func_name, " params: ", function_params, " sig: ", function_sig, " call: ", function_call)
      const proxy_func_name = "proxy_" + func_name
      func_map[proxy_func_name + "(address,uint8,bytes32,bytes32,address,uint256" +function_sig+ ")"] = {func_name, attributes, proxy_func_name, function_params, function_call}
    }
    const positions = func.src.split(':')
    inject_point = parseInt(positions[0]) + parseInt(positions[1])
  }

  if(inject_point > 0)
  {
    let msg_checks = ""
    let proxy_decls = ""

    for (const func_sig in func_map) {
      if (msg_checks)
      {
        msg_checks += " || "
      }
      msg_checks += "msg.sig == " + web3.utils.sha3(func_sig).substring(0, 10) 
      const {func_name, attributes, proxy_func_name, function_params, function_call} = func_map[func_sig]
      proxy_decls += `
    function ${proxy_func_name}(address __sender, uint8 __v, bytes32 __r, bytes32 __s, address __ntracker, uint256 __nonce${function_params.length?", " + function_params:""}) ${attributes.payable ? 'payable': ''} public {
      bytes32 in_hash = keccak256("${func_name}", address(this), __ntracker, __nonce${function_call.length?", " + function_call:""});
      if (OnBehalfableLibrary.hashCheck(__sender, __v, __r, __s, in_hash) && NonceTracker(__ntracker).setNonce(__sender, __nonce))
      {
        ${func_name}(${function_call});
      }
      else
      {
        emit UnMatchedData(address(this), __ntracker, __nonce);
        emit UnMatchedHash(in_hash);
      }
    }
      `
    }
  
    const injected = `
  event UnMatchedData(address _contract, address _nonce_tracker, uint256 _nonce);
  event UnMatchedHash(bytes32 hash);

    ${proxy_decls}
    `
    const sender_getter_func = "getSender_" + contract_name + "()"
    const library_injection = `
    function ${sender_getter_func} internal view returns (address) 
    {
      if(msg.data.length > 100 && (${msg_checks}))
      {
        return msg.data.toAddress(16);
      }
      return msg.sender;
    }
    `
    const contract_positions = contract.src.split(":")
    const contract_start = parseInt(contract_positions[0])
    const contract_end = contract_start + parseInt(contract_positions[1])
    const sender_regex = /msg\.sender/g
    const sender_getter = "OnBehalfableLibrary." + sender_getter_func
    const injected_source = source.substring(contract_start, inject_point).replace(sender_regex, sender_getter) + injected 
        + source.substring(inject_point, contract_end).replace(sender_regex, sender_getter)
    return {contract_start, contract_end, injected_source, library_injection}
  }

}

function precompile(srcFolder, dstFolder) {
  rimraf.sync(dstFolder)
  const inputs = {}
  crawlForInputs(srcFolder, "", inputs)

  console.log("Found inputs:", Object.keys(inputs))
  const output = solc.compile({sources:inputs}, 1)
  console.log("Compile errors:", output.errors)
  const writeFiles = {}
  let library_injection = "";

  for (const s in output.sources)
  {
    const injections = []
    const source = output.sources[s]
    if (source.AST && source.AST.children)
    {
      for (const contract of source.AST.children)
      {
        if (contract.name == 'ContractDefinition' && contract.attributes.contractKind == 'contract' && 
            contract.attributes.documentation &&
            contract.attributes.documentation.endsWith(BEHAFABLE_NOTICE) )
        {
          const contract_name = contract.attributes.name
          console.log("looking at:", contract_name)
          console.log("file:", s, " contract: ", contract_name, " contains OnBehalfable.")
          const inject = injectProxyFunctions(contract_name, contract, inputs[s])
          if (inject)
          {
            injections.push(inject)
            library_injection += inject.library_injection
          }
        }
      }
    }

    const source_str = inputs[s]
    let out_str = ""
    if (injections.length)
    {
      let last_end = source_str.length
      injections.sort((a,b) => b.contract_start - a.contract_start)
      for (const {contract_start, contract_end, injected_source} of injections)
      {
        out_str = injected_source + source_str.substring(contract_end, last_end) + out_str
        last_end = contract_start
      }
      out_str = source_str.substring(0, last_end) + out_str
      //console.log("Precompile of: ", s, "is: ", out_str)
    }
    else
    {
      out_str = source_str
    }
    writeFiles[s] = out_str
  }

  if (library_injection.length && output.sources[BEHAFABLE_LIBRARY])
  {
    const source = output.sources[BEHAFABLE_LIBRARY]
    const source_str = inputs[BEHAFABLE_LIBRARY]
    if (source.AST && source.AST.children)
    {
      for (const library of source.AST.children)
      {
        if (library.name == 'ContractDefinition' && library.attributes.contractKind == 'library' && library.children.length)
        {
          const src_positions = library.children[library.children.length-1].src.split(":")
          const inject_point = parseInt(src_positions[0]) + parseInt(src_positions[1])
          writeFiles[BEHAFABLE_LIBRARY] = source_str.substring(0, inject_point) + library_injection + source_str.substring(inject_point);
          break;
        }
      }
    }
  }

  if (writeFiles)
  {
    for (const w in writeFiles)
    {
      const dst_path = dstFolder + "/" + w
      const dst_dir_path = path.dirname(dst_path)
      mkdirp.sync(dst_dir_path)
      fs.writeFileSync(dst_path, writeFiles[w])
    }
  }
}

//precompile("./contracts/contracts", "./contracts/precomp_contracts")
module.exports = precompile
