# This version is a AWS services version of Logo Quiz. Enjoy and have fun!
This is forked from Logo-quip github. Thanks

# LogoQuiz

Can you guess any of [these logos](https://logoquiz.dev/)?

![demo gif](media/demo.gif)

**Note:** This project is still highly experimental. It was created as a personal introduction to React, Redux and NestJS. You may find some bad practices in the code.

Report bugs or feature requests by opening an [issue](https://github.com/hspoon-aws/logo-quiz-aws/issues).

## Contribute

You'll need Docker to run an instance of the database server. Then run the following commands.

1. Run database
```
docker compose up mongodb
```

2. Run backend
```
docker compose up api
```
The backend will run in port 3333

3. Run frontend
```
docker compose up web
```
 
The frontend will run in port 4200

## Resources

1. Obfuscate & Randomize: https://repl.it/@caroso1222/obfuscate-randomize
2. Mock credentials. Email: quiz@gmail.com. Pwd: testing
