/**
시민		1
마피아	2
경찰		3
의사		4
**/

module.exports = {
	status_list :  { 1 : '시민', 2 : '마피아', 3 : '경찰', 4 : '의사'},

	survey_list : ['나재흠', '강병관', '이현원T', '신현태T'],

	help :	'----------------- 도움말 ----------------- <br>' +
			"도움말은 '/h', '/help', '/도움말'을 입력해 볼 수 있습니다.<br>" +
			'시민 승리 조건 : 모든 마피아가 죽었을 때 <br>' +
			'마피아 승리 조건 : 마피아끼리 남거나 마피아가 아닌 한 사람과 남게 될 때 <br><br> ' +
			'* 낮의 투표 진행 방식 *<br>' + 
			"'/투표', '/ㅌㅍ'를 입력하면 낮의 투표를 진행하기 위한 표를 모읍니다. <br>" +
			'살아남은 사람들이 모두 낮의 투표를 위한 표를 행사해야만 낮의 투표가 진행됩니다. <br>',
	
	showAll : function(citizenId, mafiaId, doctorId, policeId){	
		var i;

		console.log('citizen');
		for(i in citizenId)
			console.log(i + ' : ' + citizenId[i]);

		console.log('mafia');
		for(i in mafiaId)
			console.log(i + ' : ' + mafiaId[i]);

		console.log('doctor');
		for(i in doctorId)
			console.log(i + ' : ' + doctorId[i]);

		console.log('police');
		for(i in policeId)
			console.log(i + ' : ' + policeId[i]);
	},
}
