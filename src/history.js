import { clone, validateProject } from './model.js';
function share(old,value){
  if(old===value)return old;
  if(!old||!value||typeof old!=='object'||typeof value!=='object'||Array.isArray(old)!==Array.isArray(value))return value;
  const keys=Object.keys(value);let same=keys.length===Object.keys(old).length;
  for(const key of keys){value[key]=share(old[key],value[key]);if(value[key]!==old[key])same=false;}
  return same?old:value;
}
export class History{
  constructor(value){this.current=validateProject(value);this.past=[];this.future=[];}
  edit(mutator){
    const next=clone(this.current);mutator(next);const valid=validateProject(next);
    const shared=share(this.current,valid);
    if(shared===this.current)return false;
    this.past.push(this.current);if(this.past.length>50)this.past.shift();
    this.current=shared;this.future=[];return true;
  }
  replace(value){const next=validateProject(value);this.past.push(this.current);if(this.past.length>50)this.past.shift();this.current=next;this.future=[];}
  undo(){if(!this.past.length)return false;this.future.push(this.current);this.current=this.past.pop();return true;}
  redo(){if(!this.future.length)return false;this.past.push(this.current);this.current=this.future.pop();return true;}
}
