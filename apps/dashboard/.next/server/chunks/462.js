"use strict";exports.id=462,exports.ids=[462],exports.modules={4462:(e,t,s)=>{s.d(t,{AIReasoner:()=>a});class a{constructor(e,t="https://api.openai.com/v1"){this.apiKey=e,this.baseUrl=t}async explainMigration(e,t,s){if(!this.apiKey||""===this.apiKey)return this.generateTemplateExplanation(e);try{let a=this.buildMigrationExplanationPrompt(e,t,s),r=await this.callOpenAI(a);return this.parseMigrationExplanation(r)}catch(t){return console.error("AI explanation failed, using template:",t),this.generateTemplateExplanation(e)}}async assessRisk(e,t,s){if(!this.apiKey||""===this.apiKey)return this.generateTemplateRiskAssessment(e);try{let a=this.buildRiskAssessmentPrompt(e,t,s),r=await this.callOpenAI(a);return this.parseRiskAssessment(r)}catch(t){return console.error("AI risk assessment failed, using template:",t),this.generateTemplateRiskAssessment(e)}}async query(e,t,s,a){if(!this.apiKey||""===this.apiKey)return"AI queries require an API key. Please configure OPENAI_API_KEY.";try{let r=this.buildQueryPrompt(e,t,s,a),i=await this.callOpenAI(r);return i.choices[0]?.message?.content||"No response from AI."}catch(e){return`Error: ${e instanceof Error?e.message:"Unknown error"}`}}buildMigrationExplanationPrompt(e,t,s){return`You are a database migration expert. Analyze the following schema mismatches and provide a clear explanation.

Mismatches:
${JSON.stringify(e,null,2)}

Code Schema:
${t?JSON.stringify(t,null,2):"Not provided"}

Database Schema:
${s?JSON.stringify(s,null,2):"Not provided"}

Provide a JSON response with:
- summary: Brief one-line summary
- description: Detailed explanation
- steps: Array of migration steps
- riskLevel: low, medium, high, or critical
- dataLossRisk: boolean
- estimatedDowntime: number in seconds
- recommendations: Array of recommendations
- rollbackPlan: How to rollback these changes

Be specific about risks, especially for data loss or downtime.`}buildRiskAssessmentPrompt(e,t,s){return`You are a database risk assessment expert. Analyze these schema mismatches and assess the risk.

Mismatches:
${JSON.stringify(e,null,2)}

Provide a JSON response with:
- severity: low, medium, high, or critical
- dataLossRisk: boolean
- downtime: number in seconds
- affectedRecords: estimated number (if applicable)
- recommendations: Array of safety recommendations`}buildQueryPrompt(e,t,s,a){return`You are a database schema expert. Answer this question about the schema mismatches:

Question: ${e}

Mismatches:
${JSON.stringify(t,null,2)}

Code Schema:
${s?JSON.stringify(s,null,2):"Not provided"}

Database Schema:
${a?JSON.stringify(a,null,2):"Not provided"}

Provide a clear, helpful answer.`}async callOpenAI(e){let t=await fetch(`${this.baseUrl}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:"You are a database migration expert. Provide helpful, accurate explanations in JSON format when requested."},{role:"user",content:e}],temperature:.3,max_tokens:2e3})});if(!t.ok){let e="Unknown error";try{let s=await t.json();e=s?.error?.message||t.statusText}catch{e=t.statusText}throw Error(`OpenAI API error: ${e}`)}return t.json()}parseMigrationExplanation(e){try{let t=e.choices[0]?.message?.content||"{}",s=t.match(/```json\n([\s\S]*?)\n```/)||t.match(/```\n([\s\S]*?)\n```/),a=s?s[1]:t,r=JSON.parse(a);return{summary:r.summary||"Migration explanation",description:r.description||"",steps:r.steps||[],riskLevel:r.riskLevel||"medium",dataLossRisk:r.dataLossRisk||!1,estimatedDowntime:r.estimatedDowntime||0,affectedRecords:r.affectedRecords,recommendations:r.recommendations||[],rollbackPlan:r.rollbackPlan||"Review migration SQL for rollback steps."}}catch(t){let e=t instanceof Error?t.message:String(t);throw Error(`Failed to parse AI response: ${e}`)}}parseRiskAssessment(e){try{let t=e.choices[0]?.message?.content||"{}",s=t.match(/```json\n([\s\S]*?)\n```/)||t.match(/```\n([\s\S]*?)\n```/),a=s?s[1]:t,r=JSON.parse(a);return{severity:r.severity||"medium",dataLossRisk:r.dataLossRisk||!1,downtime:r.downtime||0,affectedRecords:r.affectedRecords||0,recommendations:r.recommendations||[]}}catch(t){let e=t instanceof Error?t.message:String(t);throw Error(`Failed to parse AI response: ${e}`)}}generateTemplateExplanation(e){let t=e.filter(e=>"error"===e.severity),s=e.filter(e=>"warning"===e.severity);return{summary:`Migration for ${e.length} mismatch(es)`,description:`This migration addresses ${t.length} critical error(s) and ${s.length} warning(s) between your code schema and database schema.`,steps:e.map(e=>`Fix ${e.type}: ${e.model}${e.field?"."+e.field:""}`),riskLevel:t.length>0?"high":"low",dataLossRisk:e.some(e=>"extra_field"===e.type||"missing_table"===e.type),estimatedDowntime:t.length>0?30:0,recommendations:["Review the generated SQL before applying","Test on a staging database first","Backup your database before applying","Apply during low-traffic periods if possible"],rollbackPlan:"Review the migration SQL for rollback statements. If no rollback is provided, manually revert the changes."}}generateTemplateRiskAssessment(e){let t=e.filter(e=>"error"===e.severity),s=e.some(e=>"extra_field"===e.type||"missing_table"===e.type);return{severity:t.length>0?"high":"low",dataLossRisk:s,downtime:t.length>0?30:0,affectedRecords:0,recommendations:["Test migration on staging first","Backup database before applying","Review all SQL statements carefully"]}}}}};