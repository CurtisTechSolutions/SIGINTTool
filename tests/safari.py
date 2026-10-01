"""Real Safari smoke test using Apple's bundled WebDriver; no Selenium dependency."""
import json, subprocess, time, urllib.request, urllib.error, platform

server = subprocess.Popen(["node", "scripts/serve.mjs"])
driver = subprocess.Popen(["/usr/bin/safaridriver", "--port", "4444"])
session = None

def request(method, path, body=None):
    payload = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request("http://127.0.0.1:4444"+path, data=payload, method=method, headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=130) as result:
            data=json.load(result)
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    value=data.get("value")
    if isinstance(value, dict) and value.get("error"): raise RuntimeError(value)
    return value

def script(source, args=None, asynchronous=False):
    return request("POST", "/session/"+session+"/execute/"+("async" if asynchronous else "sync"), {"script":source,"args":args or []})

def async_script(source):
    value=script("const done=arguments[arguments.length-1];(async()=>{"+source+"})().then(done,e=>done({error:e.stack||e.message}));", asynchronous=True)
    if isinstance(value, dict) and value.get("error"): raise RuntimeError(value["error"])
    return value

def click(selector):
    result=request("POST","/session/"+session+"/element",{"using":"css selector","value":selector})
    key=result.get("element-6066-11e4-a52e-4f735466cecf") or result.get("ELEMENT")
    request("POST","/session/"+session+"/element/"+key+"/click",{})

try:
    for _ in range(100):
        try:
            request("GET","/status")
            urllib.request.urlopen("http://127.0.0.1:4173",timeout=1).close()
            break
        except Exception: time.sleep(.2)
    result=request("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"Safari"}}})
    session=result["sessionId"]
    print("SAFARI_CAPABILITIES:"+json.dumps({"macOS":platform.mac_ver()[0],"machine":platform.machine(),"capabilities":result["capabilities"]}),flush=True)
    request("POST","/session/"+session+"/timeouts",{"script":120000,"pageLoad":30000,"implicit":0})
    request("POST","/session/"+session+"/url",{"url":"http://127.0.0.1:4173"})
    async_script("window.testApp=(await import('/src/app.js')).app;await testApp.ready;testApp.edit(p=>{p.duration=.08;p.name='Safari fixture';});return true;")
    codecs=async_script("""
      const {Importer}=await import('/src/importer.js'),{makeAsset}=await import('/src/storage.js');
      const results=[];
      for(const type of ['wav','mp3']){
        const bytes=await (await fetch('/.fixtures/tone.'+type)).arrayBuffer(),importer=new Importer();
        const info=await importer.load(new File([bytes],'tone.'+type));
        const trimmed=await importer.trim({start:0,end:.1,channel:'mix',sampleRate:48000});importer.cancel();
        const asset=await makeAsset(trimmed.samples,48000,'Safari '+type,trimmed.provenance);
        await testApp.store.transaction(['audio','audioMeta'],'readwrite',tx=>testApp.store.putAsset(tx,asset));
        testApp.assets[asset.id]=asset;testApp.edit(p=>{p.assets.push(asset.id);p.modulation.sourceId=asset.id;});
        results.push({type,rate:info.sampleRate,channels:info.channels,frames:asset.frames});
      }
      testApp.edit(p=>{p.modulation.enabled=true;p.modulation.mode='ring';p.modulation.depth=1;});
      return results;
    """)
    assert all(c["rate"]==44100 and c["channels"]==2 and c["frames"]==4800 for c in codecs),codecs
    click("#play")
    for _ in range(150):
        state=script("return {render:!!testApp.lastRender,status:document.querySelector('#status').textContent};")
        if state["render"]: break
        time.sleep(.1)
    assert state["render"],state
    audio=script("return {peak:testApp.lastRender.peak,rate:testApp.lastRender.sampleRate,state:testApp.transport.context.state};")
    assert 0<audio["peak"]<=.950001 and audio["state"]=="running",audio
    click("#stop")
    saved=async_script("""
      await testApp.library.save(null);
      const entry=testApp.library.entries[0];if(!entry)throw Error('No saved sound');
      testApp.edit(p=>{p.voices[0].hz=880;});
      const snapshot=await testApp.store.get('projects',entry.projectId);
      return {saved:snapshot.project.voices[0].hz,current:testApp.project.voices[0].hz};
    """)
    assert saved=={"saved":440,"current":880},saved
    print("SAFARI_RESULT:"+json.dumps({"codecs":codecs,"audio":audio,"snapshotIsolation":saved}),flush=True)
finally:
    if session:
        try: request("DELETE","/session/"+session)
        except Exception: pass
    driver.terminate()
    server.terminate()
