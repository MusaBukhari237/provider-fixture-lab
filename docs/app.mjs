const el=id=>document.getElementById(id), output=()=>el("result");
let urls=[];
function show(message) {
  for(const url of urls) URL.revokeObjectURL(url);
  urls=[];
  output().replaceChildren();
  const summary=document.createElement("p");
  summary.className="result-summary";
  summary.setAttribute("aria-live","polite");
  summary.textContent=message;
  output().append(summary);
}
function paragraph(text) {
  const p=document.createElement("p");
  p.textContent=text;
  output().append(p);
}
function run(callback) {
  el("run").onclick=async()=>{
    el("run").disabled=true;
    try{await callback();}catch(error){show(error.message);}
    finally{el("run").disabled=false;}
  };
}
function table(rows) {
  const wrap=document.createElement("div"), data=document.createElement("table"), head=data.createTHead(), body=data.createTBody();
  wrap.className="table-wrap";
  rows.forEach((row,index)=>{
    const tr=(index?body:head).insertRow();
    for(const value of row){
      const cell=document.createElement(index?"td":"th");
      cell.textContent=String(value??"—");
      if(!index)cell.scope="col";
      tr.append(cell);
    }
  });
  wrap.append(data); output().append(wrap);
}
function download(name,contents,type) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  urls.push(url);
  const anchor=document.createElement("a");
  anchor.className="button quiet export";
  anchor.textContent="Download "+name;
  anchor.download=name;
  anchor.href=url;
  output().append(anchor);
}
const n=id=>el(id).value.trim()?Number(el(id).value):NaN;
import {inspectFixture} from "./tool.mjs";
el("sample").onclick=()=>{
 const provider=el("provider").value;
 const text="The two test runs used the same sample workload.";
 const bodies={
   chat:{choices:[{message:{content:text},finish_reason:"stop"}],usage:{prompt_tokens:92,completion_tokens:12}},
   messages:{content:[{type:"text",text}],stop_reason:"end_turn",usage:{input_tokens:92,output_tokens:12}},
   gemini:{candidates:[{finishReason:"STOP",content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:92,candidatesTokenCount:12}}
 };
 el("status").value="200";el("headers").value="Content-Type: application/json";el("source").value=JSON.stringify(bodies[provider],null,2);
};
run(()=>{
 const result=inspectFixture(el("provider").value,n("status"),el("headers").value,el("source").value);
 show(result.category+" · HTTP "+result.status);
 table([["Response","Input tokens","Output tokens","Retry suggested","Retry delay (s)"],[result.responseType,result.usageIn,result.usageOut,result.retryable?"Yes":"—",result.retryAfterSeconds]]);
 if(result.issues.length)table([["Shape notes"],...result.issues.map(x=>[x])]);
 for(const value of result.blocks.slice(0,20))paragraph(value);
 const {blocks,...summary}=result;
 download("fixture-diagnostics.json",JSON.stringify(summary,null,2)+"\n","application/json");
});
