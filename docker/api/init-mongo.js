const fs = require('fs');
db = db.getSiblingDB('logo-quiz');


db.createUser({
  user: 'root',
  pwd: 'example',
  roles: [
    {
      role: 'readWrite',
      db: 'logo-quiz'
    }
  ]
});








const level1 = db.levels.insertOne({ difficulty: 1, name: 'Level 1', scoreToUnlock: 0 });
const level2 = db.levels.insertOne({ difficulty: 2, name: 'Level 2', scoreToUnlock: 0 });
const level3 = db.levels.insertOne({ difficulty: 3, name: 'Level 3', scoreToUnlock: 2 });

processline = function (path, levelid) {
  console.log("path: " + path);
  console.log("levelid: " + levelid);
  sessions = path.split('/');
  category = sessions[1];
  filename = sessions[4];

  console.log("category: " + category);
  console.log("filename: " +filename);
  serviceName = filename.split('_')[1].replace('AWS-', '').replace('Amazon-', '').replaceAll('-', ' ')
  letters = serviceName.split('').sort(function(){return 0.5-Math.random()}).join('');
  console.log("serviceName: " + serviceName);
  console.log("letters: " +letters);

  output = {
    obfuscatedImageUrl: path,
    realImageUrl: path,
    name: serviceName.toLowerCase(),
    letters: letters.replaceAll(' ', '').toLowerCase(),
    level: levelid
  };

  return output;
}

/*fs.readFile('/icon_path_64.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
  paths = data.split('\n')
  console.log(paths.length);
  for(i=0; i< 10; i++) {
    processline(paths[i]);

  }
});*/

data = fs.readFileSync('/icon_path_64.txt', 'utf8')
console.log(data);
paths = data.split('\n')
paths = paths.sort(function(a,b){return a.length - b.length})
console.log(paths.length);
level1_data = []
level2_data = []
level3_data = []
for(i=0; i< 30; i++) {
  level1_data.push(processline(paths[i], level1.insertedId));
}
//console.log(level1_data);
db.logos.insertMany(level1_data);
console.log('done 1');

for(i=30; i< 80; i++) {
  level2_data.push(processline(paths[i], level2.insertedId));
}
db.logos.insertMany(level2_data);
console.log('done 2');

for(i=80; i< 200; i++) {
  level3_data.push(processline(paths[i], level3.insertedId));
}
db.logos.insertMany(level3_data);
console.log('done 3');


/*
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  name: 'emr',
  letters: 'pguxnerutacmla',
  level: level1.insertedId
});
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  name: 'athena',
  letters: 'athenaqwertyui',
  level: level1.insertedId
});
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  name: 'emr',
  letters: 'pguxnerutacmla',
  level: level1.insertedId
});

db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  name: 'athena',
  letters: 'athenaqwertyui',
  level: level2.insertedId
});
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  name: 'emr',
  letters: 'pguxnerutacmla',
  level: level2.insertedId
});

db.logos.insertOne({
  obfuscatedImageUrl:
    'https://res.cloudinary.com/dvug9mnfm/image/upload/v1590438390/voevjwpoeapcnn_td01ho.jpg',
  realImageUrl: 'https://res.cloudinary.com/dvug9mnfm/image/upload/v1590438390/gepznvconqfipc_q9mkkt.jpg',
  name: 'opencv',
  letters: 'voevjwpoeapcnn',
  level: level3.insertedId
});
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-Athena_48.png',
  name: 'athena',
  letters: 'athenaqwertyui',
  level: level3.insertedId
});
db.logos.insertOne({
  obfuscatedImageUrl:
    'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  realImageUrl: 'assets/Architecture-Service-Icons/Arch_Analytics/Arch_48/Arch_Amazon-EMR_48.png',
  name: 'emr',
  letters: 'pguxnerutacmla',
  level: level3.insertedId
});*/



db.users.insertOne({ name: 'Test' });