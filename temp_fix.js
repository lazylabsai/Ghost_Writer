const fs = require('fs');
const file = 'src/components/GhostWriterInterface.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/<div className="flex gap-1\.5">[\s\S]*?<\/div>/g, 
`<div className="flex items-center gap-1.5">
                                                    <CopyCodeButton code={code} />
                                                </div>`);
fs.writeFileSync(file, code);
console.log("Done");
