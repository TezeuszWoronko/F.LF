/*\
 * special attack
\*/

define(['LF/livingobject','LF/global','core/util', 'core/math'],
function(livingobject, Global, Futil, Math)
{
var GC=Global.gameplay;

	/*\
	 * specialattack
	 [ class ]
	\*/
	var states=
	{
		'generic':function(event,K)
		{	var $=this;
			switch (event) {

			case 'TU':
				$.interaction();
				$.mech.dynamics();
				//	<YinYin> hit_a is the amount of hp that will be taken from a type 3 object they start with 500hp like characters it can only be reset with F7 or negative hits - once the hp reaches 0 the type 3 object will go to frame noted in hit_d - also kind 9 itrs (john shield) deplete hp instantly.
				if( $.frame.D.hit_a)
					$.health.hp -= $.frame.D.hit_a;
			break;

			case 'frame':
				if( $.frame.D.opoint)
					$.match.create_object($.frame.D.opoint, $);
				if( $.frame.D.sound)
					$.match.sound.play($.frame.D.sound);
			break;

			case 'frame_force':
			case 'TU_force':
				if( $.frame.D.hit_j)
				{
					var dvz = $.frame.D.hit_j - 50;
					$.ps.vz = dvz;
				}
			break;

			case 'leaving':
				if( $.bg.leaving($, 200)) //only when leaving far
				{
					$.trans.frame(1000); //destroy
				}
			break;
			
			case 'hit':
			case 'hit_others':
				$.match.sound.play($.data.bmp.weapon_broken_sound);
			break;

			case 'die':
				$.trans.frame($.frame.D.hit_d);
			break;

			}
			$.states['300X'].call($, event, K);
		},

		'9':function(event,K) //catching, throw lying man
		{	
			var $=this;
			$.handle_catching_state(event, K);
		},

		'400':function(event,K) //teleport to the nearest enemy
		{	
			this.handle_teleport_state(event, K);
		},

		/*	State 300X - Ball States
			descriptions taken from
			http://lf-empire.de/lf2-empire/data-changing/reference-pages/182-states?showall=&start=29
		*/
		'300X':function(event,K)
		{	var $=this;
			switch (event) {
			case 'TU':
				/*	<zort> chasing ball seeks for 72 frames, not counting just after (quantify?) it's launched or deflected. Internally, LF2 keeps a variable keeping track of how long the ball has left to seek, which starts at 500 and decreases by 7 every frame until it reaches 0. while seeking, its maximum x speed is 14, and its x acceleration is 0.7; it can climb or descend, by 1 px/frame; and its maximum z speed is 2.2, with z acceleration .4. when out of seeking juice, its speed is 17. the -7 in the chasing algorithm comes from hit_a: 7.
				*/
				if( $.frame.D.hit_Fa && $.frame.D.hit_Fa !== 0 && $.frame.D.hit_Fa !== 10)
				if( $.health.hp>0)
				{
					$.chase_target();
					var T = $.chasing.target;
					var dx = T.ps.x - $.ps.x,
						dy = T.ps.y - $.ps.y,
						dz = T.ps.z - $.ps.z;
					if( $.ps.vx*(dx>=0?1:-1) < 14)
						$.ps.vx += (dx>=0?1:-1) * 0.7;
					if( $.ps.vz*(dz>=0?1:-1) < 2.2)
						$.ps.vz += (dz>=0?1:-1) * 0.4;
					//$.ps.vy = (dy>=0?1:-1) * 1.0;
					$.switch_dir($.ps.vx>=0?'right':'left');
				}
				if( $.frame.D.hit_Fa===10)
				{
					$.ps.vx = ($.ps.vx>0?1:-1) * 17;
					$.ps.vz = 0;
				}
			break;
		}},

		/*	<zort> you know that when you shoot a ball between john shields it eventually goes out the bottom? that's because when a projectile is spawned it's .3 pixels or whatever below its creator and whenever it bounces off a shield it respawns.
		*/

		//	State 3000 - Ball Flying is the standard state for attacks.  If the ball hits other attacks with this state, it'll go to the hitting frame (10). If it is hit by another ball or a character, it'll go to the the hit frame (20) or rebounding frame (30).
		'3000':function(event, ITR, att, attps, rect)
		{	var $=this;
			switch (event) {

			case 'hit_others':	
				$.ps.vx = 0;
				$.ps.vz = 0;
				$.trans.frame(10);
			break;
			
			case 'hit': //hit by others
				//can only attack objects of same team if head on collide
				if( att.team===$.team && att.ps.dir===$.ps.dir)
					return false;
				else
				{
					 $.ps.vx = 0;
					 $.ps.vz = 0;
					 $.trans.frame(10); //go to hitting frame
					 return true;
				}
			break;

			case 'state_exit':
				//ice column broke
				if( $.match.broken_list[$.id])
					$.brokeneffect_create($.id);
			break;
		}},

		'3006':function(event, ITR, att, attps, rect)
		{	var $=this;
			switch (event) {
			case 'hit_others':
				if( att.type==='specialattack' &&
					(att.state()===3005 || att.state()===3006)) //3006 can only be destroyed by 3005 or 3006
				{
					$.trans.frame(10);
					$.ps.vx = 0;
					$.ps.vz = 0;
					return true;
				}
			break;
			case 'hit': //hit by others
				if( att.type==='specialattack' &&
					(att.state()===3005 || att.state()===3006)) //3006 can only be destroyed by 3005 or 3006
				{
					$.trans.frame(20);
					$.ps.vx = 0;
					$.ps.vz = 0;
					return true;
				}
			break;
		}},

		'15':function(event,K) //whirlwind
		{	var $=this;
			switch (event) {
			case 'TU':
				$.ps.vx = $.dirh() * $.frame.D.dvx;
			break;
		}},

		'x':function(event,K)
		{	var $=this;
			switch (event) {
		}}
	};

	//inherit livingobject
	function specialattack(config,data,thisID)
	{
		var $=this;
		// chain constructor
		livingobject.call($,config,data,thisID);
		// constructor
		$.team = config.team;
		$.match = config.match;
		$.health.hp = $.proper('hp') || GC.default.health.hp_full;
		$.mech.mass = 0;
		$.setup();
	}
	specialattack.prototype = new livingobject();
	specialattack.prototype.constructor = specialattack;
	specialattack.prototype.states = states;
	specialattack.prototype.type = 'specialattack';

	specialattack.prototype.init = function(config)
	{
		var pos = config.pos,
			z = config.z,
			parent_dir = config.dir,
			opoint = config.opoint,
			dvz = config.dvz;
		var $=this;
		$.parent = config.parent;
		$.mech.set_pos(0,0,z);
		$.mech.coincideXY(pos,$.mech.make_point($.frame.D,'center'));
		var dir;
		var face = opoint.facing;
		if( face>=20)
			face = face%10;
		if( face===0)
			dir=parent_dir;
		else if( face===1)
			dir=(parent_dir==='right'?'left':'right');
		else if( 2<=face && face<=10)
			dir='right';
		else if(11<=face && face<=19) //adapted standard
			dir='left';
		$.switch_dir(dir);

		$.trans.frame(opoint.action===0?999:opoint.action);
		$.trans.trans();

		$.ps.vx = $.dirh() * opoint.dvx;
		$.ps.vy = opoint.dvy;
		$.ps.vz = $.frame.D.dvx ? dvz : 0;
	}

	specialattack.prototype.interaction=function()
	{
		var $=this;
		var ITR=Futil.make_array($.frame.D.itr);

		if( $.team!==0)
		for( var j in ITR)
		{	//for each itr tag
			var vol=$.mech.volume(ITR[j]);
			if( !vol.zwidth)
				vol.zwidth = 0;
			var hit= $.scene.query(vol, $, {tag:'body'});
			for( var k in hit)
			{	//for each being hit
				if( ITR[j].kind===0 ||
					ITR[j].kind===9 || //shield
					ITR[j].kind===15 || //whirlwind
					ITR[j].kind===16) //whirlwind
				{
					//state 18 allows for hitting teammates but not with effect 21/22
					var bShouldHitTeamate = !ITR[j].effect || ITR[j].effect && ITR[j].effect !== 21 && ITR[j].effect !== 22;
					bShouldHitTeamate = bShouldHitTeamate && $.state() === 18
					if( !(hit[k].type==='character' && hit[k].team===$.team && !bShouldHitTeamate)) //cannot attack characters of same team
					if( !(ITR[j].kind===0 && hit[k].type!=='character' && hit[k].team===$.team && hit[k].ps.dir===$.ps.dir)) //kind:0 can only attack objects of same team if head on collide
					if( !$.itr.arest)
					if( $.attacked(hit[k].hit(ITR[j],$,{x:$.ps.x,y:$.ps.y,z:$.ps.z},vol)))
					{	//hit you!
						$.itr_arest_update(ITR);
						$.state_update('hit_others', ITR[j], hit[k]);
						if( ITR[j].arest)
							break; //attack one enemy only
						if( hit[k].type==='character' && ITR[j].kind===9)
							//hitting a character will cause shield to disintegrate immediately
							$.health.hp = 0;
					}
				}
				else if( ITR[j].kind===8) //heal
				{
					if( hit[k].type==='character') //only affects character
					{
						$.trans.frame(ITR[j].dvx);
						this.set_pos(hit[k].ps.x, hit[k].ps.y, hit[k].ps.z);
					}
				}
				else if(ITR[j].kind===1 || ITR[j].kind===3)
				{
					if( hit[k].team !== $.team) //only catch other teams
					if( hit[k].type==='character') //only catch characters
					if( (ITR[j].kind===1 && hit[k].state()===16) //you are in dance of pain
					 || (ITR[j].kind===3)) //super catch
					if( !$.itr.arest)
					{
						var dir = hit[k].caught_a(ITR[j],$,{x:$.ps.x,y:$.ps.y,z:$.ps.z});
						if( dir)
						{
							$.itr_arest_update(ITR[j]);
							if( dir==='front')
								$.trans.frame(ITR[j].catchingact[0], 10);
							else
								$.trans.frame(ITR[j].catchingact[1], 10);
							$.catching=hit[k];
							break;
						}
					}
				}
			}
		}
	}

	specialattack.prototype.hit=function(ITR, att, attps, rect)
	{
		var $=this;
		if( $.itr.vrest[att.uid])
			return false;

		if( ITR && ITR.vrest)
			$.itr.vrest[att.uid] = ITR.vrest;
		return $.state_update('hit', ITR, att, attps, rect);
	}

	specialattack.prototype.attacked=function(inj)
	{
		return this.parent.attacked(inj);
	}
	specialattack.prototype.killed=function()
	{
		this.parent.killed();
	}
	specialattack.prototype.hit_ground = function()
	{
		this.trans.set_next(60);
		this.ps.vy = 0;
		this.ps.vx = 0;
		this.ps.vz = 0;
	}

	specialattack.prototype.chase_target=function()
	{
		//selects a target to chase after
		var $ = this;
		if( $.chasing===undefined)
		{
			$.chasing =
			{
				target: null,
				chased: {},
				query:
				{
					type:'character',
					sort:function(obj)
					{
						var dx = obj.ps.x-$.ps.x;
						var dz = obj.ps.z-$.ps.z;
						var score = Math.sqrt(dx*dx+dz*dz);
						if( $.chasing.chased[obj.uid])
							score += 500 * $.chasing.chased[obj.uid]; //prefer targets that are chased less number of times
						return score;
					}
				}
			}
		}
		$.chasing.query.not_team = $.team;
		var targets = $.match.scene.query(null, $, $.chasing.query);
		var target = targets[0];
		$.chasing.target = target;

		if( $.chasing.chased[target.uid]===undefined)
			$.chasing.chased[target.uid] = 1;
		else
			$.chasing.chased[target.uid]++;
	}

	return specialattack;
});
