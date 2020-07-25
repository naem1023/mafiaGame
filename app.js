var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var game = require('./game');
var random = require('random-js');

var app = express();


//socket.io server
var server = require('http').Server(app);
var io = require('socket.io')(server);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);
app.use('/robby', routes);
app.use('/madeby', routes);
app.use('/ingame', routes);

app.use('/users', users);

//server on
server.listen(8080, function(){
	console.log('Mafia Server Start !');
});



//socket
var socket_ids =[]; //socket - nickname

var surviveList = [];
var ingameList = [];
var statusList = [];

var live = [];

var count = 0;

var voteCount = 0;
var voteStart = 0;

var killed = 0;

var citizen, mafia, doctor, police;
citizen = mafia = doctor = police = 0;

var citizenId, mafiaId, doctorId, policeId;
citizenId = [];
mafiaId = [];
doctorId = [];
policeId = [];

var voteResult = [];

var manager;

var color = 'FF4A68';

//게임 시작 유무
var start = false;

//1 - day
//2 - night
var time;

//채팅, 귓속말
io.on('connection', function(socket){
	//newUserCon 이벤트를 통해 자동으로 생성시킨 닉네임을 현재 연결된 클라이언트 소켓에 전달.
	var new_nickname = 'GUEST-' + count;
	socket.emit('newUserCon', {nickname : new_nickname});
	   
	count++;
	
	//닉네임을 자동으로 생성해서 접속한 클라이언트의 소켓 객체에 저장.
	socket_ids[new_nickname] = socket.id;
	
	socket.nickname = new_nickname;
	surviveList[socket.nickname] = true;
	ingameList[socket.nickname] = true;
	live[socket.nickname] = true;
	
	console.log(new_nickname + ' is connected');
	
	io.sockets.emit('refreshList', Object.keys(socket_ids));

	//게임 시작
	socket.on('ready', function(data){
		if(data.from != manager)
			io.to(socket_ids[data.from]).emit('sys_msg', {msg : '방장만이 게임을 시작할 수 있습니다.'});
		else{
			if(start == false && count >= 4){
				time = 1;
				var msg_toSend = 
					data.from + '님이 게임을 시작했습니다. <br>' +
					'ver 0.0.1 Beta <br>' + 
					'created by GMD <br>' +
					game.help;
				io.sockets.emit('sys_msg', {msg : msg_toSend, color : '7DBEFF'});
				start = true;
				
				io.sockets.emit('hide');
				make_status();
			}
			else if(count < 4){
				var msg_toSend = 
					'마피아 게임은 최소 4명이 방에 입장해야만 시작 가능합니다.';
				io.sockets.emit('sys_msg', {msg : msg_toSend, color : color});
			}
			else{
				var msg_toSend = 
					'이미 게임을 시작하였습니다.';
				io.sockets.emit('sys_msg', {msg : msg_toSend, color : color});
			}
		}
	});

	socket.on('help', function(nickname){
		io.to(socket_ids[nickname]).emit('sys_msg', {msg : game.help, color : '7DBEFF'});
	});
	
	//닉네임 변경
	socket.on('changeName', function(data){
		//전에 쓰던 닉네임은 삭제
		if(socket.nickname != undefined){
			delete socket_ids[socket.nickname];
			delete ingameList[socket.nickname];
			delete surviveList[socket.nickname];
			delete live[socket.nickname];
		}

		if(socket.nickname == manager)
			manager = data.nickname;
			
		if(data.nickname == 'admin')
			manager = 'admin';
			
		/**
		* 닉네임을 현재 접속한 클라이언트의 소켓 객체에 저장.
		* 소켓 아이디-닉네임 배열에 닉네임을 key로 해서 현재 소켓 아이디 저장.
		* userlist 이벤트를 통해 현재 접속한 사용자들의 닉네임을 모든 클라이언트에 전송.
		**/
		
		socket_ids[data.nickname] = socket.id;
		ingameList[data.nickname] = true;
		surviveList[data.nickname] = true;
		live[data.nickname] = true;
		
		if(statusList[socket.nickname] != undefined){
			switch(statusList[socket.nickname]){
				case 1:
					delete citizenId[socket.nickname];
					citizenId[data.nickname] = socket.id;
					break;
				case 2:
					delete mafiaId[socket.nickname];
					mafiaId[data.nickname] = socket.id;
					break;
				case 3:
					delete policeId[socket.nickname];
					policeId[data.nickname] = socket.id;
					break;
				case 4:
					delete doctor[socket.nickname];
					doctorId[data.nickname] = socket.id;
					break;
			}
		}
		
		socket.nickname = data.nickname;

		io.sockets.emit('refreshList', Object.keys(socket_ids));
	});

	//메시지 전달
	socket.on('send_msg', function(data){
		var toSendNickname = data.toSend;
		//data.msg = toSendNickname + ' : ' + data.msg;

		//전체에게 메시지 전달
		if(data.toSend == 'ALL')
			io.sockets.emit('get_msg_all', data);            

		//특정 사용자에게만 메시지 전달
		else{
			var toSendId = socket_ids[data.toSend];
			if(toSendId != undefined){
				io.to(toSendId).emit('get_msg', data);
				socket.emit('get_msg', data);
			}
		}
	});

	//투표 시작
	socket.on('startVote', function(data){
		if(start == true && time == 1){
			voteStart++;
			
			io.sockets.emit('sys_msg', {msg : data.from + '님이 투표를 시작을 요청했습니다.', color : color});
			if (voteStart == Object.keys(socket_ids).length - killed){
				voteStart = 0;
				//전체투표
				voteToKill();
			}
		}
		else if(time == 2)
			io.to(socket_ids[data.from]).emit('sys_msg', {msg : '밤에는 직업별 투표만 가능합니다.', color : color});
		else if(start == false && (citizen == 0 || mafia == 0))
			io.to(socket_ids[data.from]).emit('sys_msg', {msg : '이미 게임이 끝났습니다.', color : color});
		else
			io.to(socket_ids[data.from]).emit('sys_msg', {msg : '투표는 게임이 시작한 후에 시작해야 합니다.', color : color});
	});
	
	
	//투표 결과 처리
	socket.on('citizenResult', function(selected){
		treatVote();
	});
	
	socket.on('mafiaResult', function(selected){
		if(surviveList[selected] == true && ingameList[selected] == true){
			surviveList[selected] = false;
			killed++;
		}
		treatVote();
	});
	
	socket.on('policeResult', function(data){	
		var tmp = statusList[data.selected];
		
		if(tmp == 2)
			io.to(socket_ids[data.nick]).emit('sys_msg', {msg : data.selected + '는 마피아입니다.', color : color});
		else
			io.to(socket_ids[data.nick]).emit('sys_msg', {msg : data.selected + '는 마피아가 아닙니다.', color : color});
			
		treatVote();
	});
	
	socket.on('doctorResult', function(selected){
		if(surviveList[selected] == false && ingameList[selected] == true){
			killed--;
			surviveList[selected] = true;
		}	
		treatVote();
	});
	
	//투표 결과 처리
	socket.on('treatMVote', function(selected){
		voteCount++;
		
		if(voteResult[selected] == undefined)
			voteResult[selected] = 1;
		else
			voteResult[selected]++;
		
		//모두 투표했을 때
		if (voteCount == Object.keys(live).length) {
			var elected = [];
			var most = selected;
			
			io.sockets.emit('sys_msg', {msg : '투표가 끝났습니다.', color : color});
			
			//init
			elected[most] = voteResult[selected];
			
			//가장 많이 뽑힌 사람 탐색
			for(var target in voteResult){
				if (elected[most] < voteResult[target]){
					elected[target] = voteResult[target];
					delete elected[most];
					most = target;
				}
				else if (elected[most] == voteResult[target]) {
					elected[target] = voteResult[target];
				}
			}
				
			//가장 많이 뽑힌 사람이 1명이 아닐 때
			if (Object.keys(elected).length != 1) {
				_elected = Object.keys(elected);
				var _msg = "";
				
				for(var i=0; i<_elected.length; i++){
					if (i == _elected.length -1 ) {
						_msg += _elected[i] + '님 을 죽이자고 ' + voteResult[most] + '명이 투표했습니다.';	
					}
					else	
						_msg += _elected[i] + '님 과';
				}
				io.sockets.emit('sys_msg', {msg : _msg, color : color});
				io.sockets.emit('sys_msg', {msg : '재투표를 하겠습니다.', color : color});
				
				voteCount = 0;
				voteToKill();
				return;
			}
			
			//사망 처리
			killPlayer(most);
			
			io.sockets.emit('sys_msg', {msg : '투표로 죽은 사람은 ' + most + '님 입니다.', color : color});
			voteCount = 0;
			
			for(i in voteResult)
				delete voteResult[i];
				
			//밤이 되고 직업 별 투표
			voteStatus();
		}
	});
	

	

	//연결이 끊어졌을 때
	socket.on('disconnect', function(){
		var toDelNickname = socket.nickname;
		console.log('*** disconnect ' + toDelNickname);

		if(toDelNickname != undefined){
			delete socket_ids[toDelNickname];
			delete live[toDelNickname];
		}

		io.sockets.emit('refreshList', {users : Object.keys(socket_ids)});
	});
});

//직업별 투표 처리
function treatVote(){
	console.log('treatVote count' + voteCount);
	voteCount++;
	
	//모두 투표했을 때
	if (voteCount == Object.keys(live).length) {
		var killCount = 0;
		var targetSc;
		
		time = 1;
		io.sockets.emit('sys_msg', {msg : '---------------------------------------------------------', color : color});
		io.sockets.emit('sys_msg', {msg : '낮이 되었습니다.', color : color});
		
		//사망자 처리
		for(var target in socket_ids){
			//죽은 놈이면 게임에서 제외
			if (surviveList[target] == false) {
				killPlayer(target);
				io.sockets.emit('sys_msg', {msg : target + '님이 죽었습니다.', color : color});
				killCount++;
			}
		}
		
		if (killCount == 0)
			io.sockets.emit('sys_msg', {msg : '아무도 죽지 않았습니다.', color : color});
		else
			io.sockets.emit('sys_msg', {msg : '죽은 사람은 ' + killed + '명 입니다.', color : color});
			
		io.sockets.emit('sys_msg', {msg : '남은 사람은 ' + Object.keys(live) + ' 입니다.', color : color});
		
		voteCount = 0;
		
		switch(whoWin()){
			case 0:
				break;
			case 1:
				io.sockets.emit('sys_msg', {msg : '마피아가 모두 죽어 시민이 승리했습니다!', color : color});
				start = false;
				showAll(1);
				io.sockets.emit('refreshList', {user : Object.keys(socket_ids), status : Object.values(statusList)} );
				break;
			case 2:
				io.sockets.emit('sys_msg', {msg : '시민이 모두 죽어 마피아가 승리했습니다!', color : color});
				start = false;
				showAll(2);
				io.sockets.emit('refreshList', {user : Object.keys(socket_ids), status : Object.values(statusList)} );
				break;
		}
	}
}

function killPlayer(player){
	ingameList[player] = false;
	delete live[player];
	
	switch(statusList[player]){
		case 1:
			citizen--;
			break;
		case 2:
			mafia--;
			break;
		case 3:
			doctor--;
			break;
		case 4:
			police--;
			break;
	}
}

function showAll(win){	
	var i;
	var msg = "--------------------------------직업공개-------------------------------------- <br>";

	msg += '시민 <br>';
	for(i in citizenId)
		msg += i + ' ';
		
	msg += '<br>마피아';
	
	for(i in mafiaId)
		msg += i + ' ';
		
	msg += '<br>의사';

	for(i in doctorId)
		msg += i + ' ';
		
	msg += '<br>경찰';
	
	for(i in policeId)
		msg += i + ' ';
	var color;
	if(win == 1)
		io.sockets.emit('sys_msg', {msg : msg, color : '66CC69'});
	else if(win == 2)
		io.sockets.emit('sys_msg', {msg : msg, color : 'FA4343'});
}
	
function whoWin(){
	if(mafia == 0)
	   return 1;
	else if(citizen + police + doctor == 1 && mafia != 0)
			return 2;
	return 0;
}

function voteToKill(){
	io.sockets.emit('sys_msg', {msg : '---------------------------------------------------------', color : color});
	io.sockets.emit('sys_msg', {msg : '투표로 죽일 사람을 선택해주세요. 투표창에서 투표를 해주세요.', color : color});
		
	for(var t in socket_ids){
		if(ingameList[t] == true)
			io.to(socket_ids[t]).emit('mainVote', {list : Object.keys(live)});	
	}
}

function voteStatus(){
	time = 2;
	io.sockets.emit('sys_msg', {msg : '---------------------------------------------------------', color : color});
	io.sockets.emit('sys_msg', {msg : '밤이 되었습니다. 투표창에서 투표를 해주세요.', color : color});
	
	var t;
	//시민에게
	for(t in citizenId){
		if(ingameList[t] == true)
			io.to(socket_ids[t]).emit('citizenVote', {list : Object.keys(live)});
	}
	//마피아에게
	for(t in mafiaId){
		if(ingameList[t] == true)
			io.to(socket_ids[t]).emit('mafiaVote', {list : Object.keys(live)});
	}
	//경찰에게
	for(t in policeId){
		if(ingameList[t] == true)
			io.to(socket_ids[t]).emit('policeVote', {list : Object.keys(live)});
	}
	//의사에게
	for(t in doctorId){
		if(ingameList[t] == true)
			io.to(socket_ids[t]).emit('doctorVote', {list : Object.keys(live)});
	}
}

//신분 결정
function make_status(){
	var status = 0;
	var def_id;
	
	//socket_ids에서 닉네임을 뽑아옴
	for(var def_nickname in socket_ids){
		//모든 신분 중 한 개의 신분이라도 0명이라면
		if(citizen == 0 || mafia == 0 || doctor == 0 || police == 0){
			while(1){
				status = random.integer(1, 4);
				
				//status에 해당하는 신분의 수가 0명이라면
				if( (citizen == 0 && status == 1) || (mafia == 0 && status == 2) || (police == 0 && status == 3) || (doctor == 0 && status == 4) ){
					def_id = socket_ids[def_nickname];
					io.to(def_id).emit('def_status', {t_status : status, msg : '당신은 ' + game.status_list[status] + '입니다.'});
					regStatus(status, def_id, def_nickname);
					break;
				}
			}
		}

		//모든 신분이 1명 씩 있을 때 부터는 무작위
		else {
			while(1) {
				status = random.integer(1, 4);
				def_id = socket_ids[def_nickname];
				
				if(status != 1 && (Object.keys(citizenId).length >= Object.keys(socket_ids).length / 2) ){
					io.to(def_id).emit('def_status', {t_status : status, msg : '당신은 ' + game.status_list[status] + '입니다.'});
					regStatus(status, def_id, def_nickname);
					break;
				}
				else if(status == 1){
					io.to(def_id).emit('def_status', {t_status : status, msg : '당신은 ' + game.status_list[status] + '입니다.'});
					regStatus(status, def_id, def_nickname);
					break;
				}
			}		
		}
	}

	//game.showAll(citizenId, mafiaId, doctorId, policeId);
}

//신분 별로 닉네임-아이디 배열 생성
//닉네임으로 아이디에 접근
function regStatus(status, def_id, def_nickname){
	statusList[def_nickname] = status;
	
	switch(status){
		//시민
		case 1:
			citizenId[def_nickname] = def_id;	
			citizen++;
			break;					
		//마피아
		case 2:
			mafiaId[def_nickname] = def_id;		
			mafia++;
			break;
		//경찰
		case 3:
			policeId[def_nickname] = def_id;
			police++;
			break;
		//의사
		case 4:
			doctorId[def_nickname] = def_id;
			doctor++;
			break;
	}
}


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;