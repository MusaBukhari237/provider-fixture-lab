const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
function safeInt(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
function statusType(status){
  if(status>=200&&status<300)return "Success";
  if(status===401||status===403)return "Authentication or access";
  if(status===429)return "Rate limit";
  if(status===408)return "Request timeout";
  if(status>=500)return "Provider error";
  if(status>=400)return "Request error";
  if(status>=300)return "Redirect";
  return "Informational";
}
function headersFrom(input){
  const map=new Map();
  for(const [i,line] of input.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    const match=/^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if(!match)throw Error("Invalid header on line "+(i+1)+". Use Name: value.");
    const name=match[1].toLowerCase();
    if(["retry-after","content-type"].includes(name))map.set(name,match[2].trim());
  }
  return map;
}
export function inspectFixture(provider,status,headers,source){
  if(!["chat","messages","gemini"].includes(provider)||!Number.isInteger(status)||status<100||status>599)throw Error("Select a provider shape and enter an HTTP status between 100 and 599.");
  const selected=headersFrom(headers);
  const retry=selected.get("retry-after");
  const retryAfterSeconds=/^\d{1,8}$/.test(retry??"")?Number(retry):null;
  const issues=[];
  if(retry&&retryAfterSeconds===null)issues.push("Retry-After is not a delay in seconds.");
  let body=null;
  try {body=JSON.parse(source);if(!object(body))throw Error();}
  catch {issues.push("Body is not a JSON object.");body=null;}
  const result={status,category:statusType(status),retryable:status===408||status===429||status>=500,retryAfterSeconds,responseType:"—",usageIn:null,usageOut:null,issues,blocks:[]};
  if(!body)return result;
  if(status>=300||status<200){
    if(typeof body.error?.message==="string")result.blocks.push(body.error.message);
    else issues.push("No error.message field found.");
    return result;
  }
  if(provider==="chat"){
    const first=body.choices?.[0];
    if(!object(first?.message)){issues.push("Missing choices[0].message.");return result;}
    if(typeof first.message.content==="string")result.blocks.push(first.message.content);
    const tools=Array.isArray(first.message.tool_calls)?first.message.tool_calls.length:0;
    result.responseType=first.finish_reason||"Message";
    if(tools)result.blocks.push(tools+" tool call"+(tools===1?"":"s")+" requested.");
    if(!result.blocks.length)issues.push("No text or tool calls found.");
    result.usageIn=safeInt(body.usage?.prompt_tokens); result.usageOut=safeInt(body.usage?.completion_tokens);
  }else if(provider==="messages"){
    if(!Array.isArray(body.content)){issues.push("Missing content blocks.");return result;}
    result.responseType=body.stop_reason||"Message";
    for(const block of body.content){
      if(block?.type==="text"&&typeof block.text==="string")result.blocks.push(block.text);
      if(block?.type==="tool_use")result.blocks.push("Tool use requested.");
    }
    if(!result.blocks.length)issues.push("No text or tool-use blocks found.");
    result.usageIn=safeInt(body.usage?.input_tokens);result.usageOut=safeInt(body.usage?.output_tokens);
  }else{
    const candidate=body.candidates?.[0];
    if(!candidate){
      result.responseType=body.promptFeedback?.blockReason?"Blocked prompt":"—";
      issues.push("No candidate was returned.");
      return result;
    }
    result.responseType=candidate.finishReason||"Candidate";
    for(const part of Array.isArray(candidate.content?.parts)?candidate.content.parts:[]){
      if(typeof part?.text==="string")result.blocks.push(part.text);
      if(object(part?.functionCall))result.blocks.push("Function call requested.");
    }
    if(!result.blocks.length)issues.push("No text or function calls found.");
    result.usageIn=safeInt(body.usageMetadata?.promptTokenCount);result.usageOut=safeInt(body.usageMetadata?.candidatesTokenCount);
  }
  if(!["Message","Candidate","stop","length","tool_calls","content_filter","function_call","end_turn","max_tokens","stop_sequence","tool_use","pause_turn","refusal","STOP","MAX_TOKENS","SAFETY","RECITATION","OTHER"].includes(result.responseType))result.responseType="Other";
  return result;
}
