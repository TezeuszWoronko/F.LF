/*\
 * livingobject
 * 
 * a base class for all living objects
\*/
define(['LF/global','LF/sprite','LF/mechanics','LF/AI','LF/util','LF/sprite-select','core/util'],
function ( Global, Sprite, Mech, AI, util, Fsprite, Futil)
{
	var GC=Global.gameplay;

	/*\
	 * livingobject
	 [ class ]
	 | config=
	 | {
	 | match,
	 | controller, (characters only)
	 | team
	 | }
	\*/
	function livingobject(config,data,thisID)
	{
		if( !config)
			return;

		var $=this;

		//identity
		$.name=data.bmp.name;
		$.uid=-1; //unique id, set by scene
		$.id=thisID; //object id
		$.data=data;
		$.team=config.team;
		$.statemem = {}; //state memory, will be cleared on every state transition

		//handles
		$.match=config.match;
		$.scene=$.match.scene;
		$.bg=$.match.background;

		//states
		
		$.health=
		{
			hp: 100,
			mp: 100
		};
		$.frame=
		{
			PN: 0, //previous frame number
			N: 0, //current frame number
			D: data.frame[config.frameN? config.frameN:0], //current frame's data object
			ani: //animation sequence
			{
				i:0, up:true
			}
		};
		//shadow
		$.sp = new Sprite(data.bmp, $.match.stage);
		$.sp.width = data.bmp.file[0].w;
		if( !$.proper('no_shadow') && $.frame.D.state!==3005)	//state 3005 no shadow
		{
			var sp_sha=
			{
				canvas: $.match.stage,
				wh: 'fit',
				img: $.bg.shadow.img
			}
			$.shadow = new Fsprite(sp_sha);
		}

		$.mech = new Mech($);
		$.AI = new AI.interface($);
		$.ps = $.mech.create_metric(); //position, velocity, and other physical properties
		$.trans = new frame_transistor($);
		$.itr=
		{
			arest: 0, //attack rest - time until the attacker can do a single hit again
			vrest:{}, //victim rest - time until a character can be hit again
		};
		$.effect=
		{
			num: -99, //effect number
			dvx: 0, dvy: 0,
			stuck: false, //when an object is said to be 'stuck', there is not state and frame update
			oscillate: 0, //if oscillate is non-zero, will oscillate for amplitude equals value of oscillate
			blink: false, //blink: hide 2 TU, show 2 TU ,,, until effect vanishs
			super: false, //when an object is in state 'super', it does not return body volume, such that it cannot be hit
			timein: 0, //time to take effect
			timeout: 0, //time to lose effect
			heal: undefined
		};
		$.catching= 0; //state 9: the object being caught by me now
					//OR state 10: the object catching me now
		$.allow_switch_dir=true; //direction switcher
	}
	livingobject.prototype.type='livingobject';
	//livingobject.prototype.states = null; //the collection of states forming a state machine
	//livingobject.prototype.states_switch_dir = null; //whether to allow switch dir in each state

	livingobject.prototype.destroy = function()
	{
		this.sp.destroy();
		if( this.shadow)
			this.shadow.remove();
	}

	livingobject.prototype.log = function(mes)
	{
		this.match.log(mes);
	}

	//setup for a match
	livingobject.prototype.setup = function()
	{
		var $=this;
		$.state_update('setup');
	}

	//update done at every frame
	livingobject.prototype.frame_update = function()
	{
		var $=this;
		//show frame
		$.sp.show_pic($.frame.D.pic);

		$.ps.fric=1; //reset friction

		if( !$.state_update('frame_force'))
			$.frame_force();

		//wait for next frame
		$.trans.set_wait($.frame.D.wait,99);
		$.trans.set_next($.frame.D.next,99);

		//state generic then specific update
		$.state_update('frame');

		if( $.frame.D.sound)
			$.match.sound.play($.frame.D.sound);
	}

	livingobject.prototype.frame_force = function()
	{
		var $=this;
		if( $.frame.D.dvx)
		{
			var avx = $.ps.vx>0?$.ps.vx:-$.ps.vx;
			if( $.ps.y<0 || avx < $.frame.D.dvx) //accelerate..
				$.ps.vx = $.dirh() * $.frame.D.dvx; //..is okay
			//decelerate must be gradual
			if( $.frame.D.dvx<0)
				$.ps.vx = $.ps.vx - $.dirh();
		}
		if( $.frame.D.dvz) $.ps.vz = $.dirv() * $.frame.D.dvz;
		if( $.frame.D.dvy) $.ps.vy += $.frame.D.dvy;
		if( $.frame.D.dvx===550) $.ps.vx = 0;
		if( $.frame.D.dvy===550) $.ps.vy = 0;
		if( $.frame.D.dvz===550) $.ps.vz = 0;
	}

	livingobject.prototype.whirlwind_force = function(rect)
	{
		var $=this;
		//lift
		$.ps.vy -= 2/$.mech.mass;
		//centripetal force
		var cx = rect.x+rect.vx+rect.w*0.5; //center
		var cz = rect.z;
		$.ps.vx -= sign($.ps.x-cx)*2/$.mech.mass;
		$.ps.vz -= sign($.ps.z-cz)*0.5/$.mech.mass;

		function sign(x)
		{
			return x>0?1:-1;
		}
	}

	//update done at every TU (30fps)
	livingobject.prototype.TU_update = function()
	{
		var $=this;

		if( !$.state_update('TU_force'))
			$.frame_force();

		//effect
		if( $.effect.timein<0)
		{
			if( $.effect.oscillate)
			{
				if( $.effect.oi===1)
					$.effect.oi=-1;
				else
					$.effect.oi=1;
				$.sp.set_x_y($.ps.sx + $.effect.oscillate*$.effect.oi, $.ps.sy+$.ps.sz);
			}
			else if( $.effect.blink)
			{
				if( $.effect.bi===undefined)
					$.effect.bi = 0;
				switch ($.effect.bi%4)
				{
					case 0: case 1:
						$.sp.hide();
					break;
					case 2: case 3:
						$.sp.show();
					break;
				}
				$.effect.bi++;
			}
			if( $.effect.timeout===0)
			{
				$.effect.num = -99;
				if( $.effect.stuck)
				{
					$.effect.stuck = false;
				}
				if( $.effect.oscillate)
				{
					$.effect.oscillate = 0;
					$.sp.set_x_y($.ps.sx, $.ps.sy+$.ps.sz);
				}
				if( $.effect.blink)
				{
					$.effect.blink = false;
					$.effect.bi = undefined;
					$.sp.show();
				}
				if( $.effect.super)
				{
					$.effect.super = false;
				}
			}
			else if( $.effect.timeout===-1)
			{
				if( $.effect.dvx) $.ps.vx = $.effect.dvx;
				if( $.effect.dvy) $.ps.vy = $.effect.dvy;
				$.effect.dvx=0;
				$.effect.dvy=0;
			}
			$.effect.timeout--;
		}

		if( $.effect.timein<0 && $.effect.stuck)
			; //stuck
		else
			$.state_update('TU');

		if( $.health.hp<=0)
			if( !$.dead)
			{
				$.state_update('die');
				$.dead = true;
			}

		if( $.bg.leaving($))
			$.state_update('leaving');

		for( var I in $.itr.vrest)
		{	//watch out that itr.vrest might grow very big
			if( $.itr.vrest[I] > 0)
				$.itr.vrest[I]--;
		}
		if( $.itr.arest > 0)
			$.itr.arest--;
	}

	livingobject.prototype.state_update=function(event)
	{
		var $=this;
		var tar1=$.states['generic'];
		if( tar1) var res1=tar1.apply($,arguments);
		//
		if($.frame.D === undefined) return;
		var tar2=$.states[$.frame.D.state];
		if( tar2) var res2=tar2.apply($,arguments);
		//
		return res1 || res2;
	}

	livingobject.prototype.TU=function()
	{
		var $=this;
		//state
		$.TU_update();
	}

	livingobject.prototype.transit=function()
	{
		var $=this;
		//fetch inputs
		if( $.con)
		{
			//$.con.fetch(); //match is responsible for fetching
			$.combo_update();
		}
		//frame transition
		if( $.effect.timein<0 && $.effect.stuck)
			; //stuck!
		else
			$.trans.trans();
		$.effect.timein--;
		if( $.effect.timein<0 && $.effect.stuck)
			; //stuck!
		else
			$.state_update('transit');
	}

	livingobject.prototype.set_pos=function(x,y,z)
	{
		this.mech.set_pos(x,y,z);
	}

	//return the body volume for collision detection
	//  all other volumes e.g. itr should start with prefix vol_
	livingobject.prototype.vol_body=function() 
	{
		return this.mech.body();
	}

	livingobject.prototype.vol_itr=function(kind)
	{
		var $=this;
		if( $.frame.D.itr)
			return $.mech.body(
				$.frame.D.itr, //make volume from itr
				function (obj) //filter
				{
					return obj.kind==kind; //use type conversion comparison
				}
			);
		else
			return $.mech.body_empty();
	}

	livingobject.prototype.state=function()
	{
		return this.frame.D.state;
	}

	livingobject.prototype.effect_id=function(num)
	{
		return num+GC.effect.num_to_id;
	}

	livingobject.prototype.effect_create=function(num,duration,dvx,dvy)
	{
		var $=this;
		num /= 10; // effect 23 is unhandled
		if( num >= $.effect.num)
		{
			var efid= num+GC.effect.num_to_id;
			if( $.proper(efid,'oscillate'))
				$.effect.oscillate=$.proper(efid,'oscillate');
			$.effect.stuck=true;
			if( dvx!==undefined)
				$.effect.dvx = dvx;
			if( dvy!==undefined)
				$.effect.dvy = dvy;
			if( $.effect.num>=0)
			{	//only allow extension of effect
				if( 0 < $.effect.timein)
					$.effect.timein=0;
				if( duration > $.effect.timeout)
					$.effect.timeout=duration;
			}
			else
			{
				$.effect.timein=0;
				$.effect.timeout=duration;
			}
			$.effect.num = num;
		}
	}

	livingobject.prototype.effect_stuck=function(timein,timeout)
	{
		var $=this;
		if( !$.effect.stuck || $.effect.num<=-1)
		{
			$.effect.num=-1; //magic number
			$.effect.stuck=true;
			$.effect.timein=timein;
			$.effect.timeout=timeout;
		}
	}

	livingobject.prototype.visualeffect_create=function(num, rect, righttip, variant, with_sound)
	{
		var $=this;
		var efid= num+GC.effect.num_to_id;
		var pos=
		{
			x: rect.x+ rect.vx+ (righttip?rect.w:0),
			y: rect.y+ rect.vy+ rect.h/2,
			z: rect.z>$.ps.z ? rect.z:$.ps.z
		}
		$.match.visualeffect.create(efid,pos,variant,with_sound);
	}

	livingobject.prototype.brokeneffect_create=function(id,num)
	{
		var $=this;
		var static_body = $.vol_body()[0];
		if( !num) num = 8;
		for( var i=0; i<num; i++)
			$.match.brokeneffect.create(320,{x:$.ps.x,y:$.ps.y,z:$.ps.z},id,i,static_body);
	}

	//animate back and forth between frame a and b
	livingobject.prototype.frame_ani_oscillate=function(a,b)
	{
		var $=this;
		var $f=$.frame;
		if( $f.ani.i<a || $f.ani.i>b)
		{
			$f.ani.up=true;
			$f.ani.i=a+1;
		}
		if( $f.ani.i<b && $f.ani.up)
			$.trans.set_next($f.ani.i++);
		else if( $f.ani.i>a && !$f.ani.up)
			$.trans.set_next($f.ani.i--);
		if( $f.ani.i==b) $f.ani.up=false;
		if( $f.ani.i==a) $f.ani.up=true;
	}

	livingobject.prototype.frame_ani_sequence=function(a,b)
	{
		var $=this;
		var $f=$.frame;
		if( $f.ani.i<a || $f.ani.i>b)
		{
			$f.ani.i=a+1;
		}
		trans.set_next($f.ani.i++);
		if( $f.ani.i > b)
			$f.ani.i=a;
	}

	livingobject.prototype.itr_arest_test=function()
	{
		var $=this;
		return !$.itr.arest;
	}
	livingobject.prototype.itr_arest_update=function(ITR)
	{
		var $=this;
		if( ITR && ITR.arest)
			$.itr.arest = ITR.arest;
		else if( !ITR || !ITR.vrest)
			$.itr.arest = GC.default.character.arest;
	}
	livingobject.prototype.itr_vrest_test=function(uid)
	{
		var $=this;
		return !$.itr.vrest[uid];
	}
	livingobject.prototype.itr_vrest_update=function(attacker_uid,ITR)
	{
		var $=this;
		if( ITR && ITR.vrest)
			$.itr.vrest[attacker_uid] = ITR.vrest;
	}

	livingobject.prototype.switch_dir = function(e)
	{
		var $=this;
		if( $.ps.dir==='left' && e==='right')
		{
			$.ps.dir='right';
			$.sp.switch_lr('right');
		}
		else if( $.ps.dir==='right' && e==='left')
		{
			$.ps.dir='left';
			$.sp.switch_lr('left');
		}
	}

	livingobject.prototype.dirh = function()
	{
		var $=this;
		return ($.ps.dir==='left'?-1:1);
	}

	livingobject.prototype.handle_teleport_state = function(event, K)
	{
		var $=this;
		switch (event) {
		case 'frame':
			var targets = $.match.scene.query(null, $, {
				not_team:$.team,
				type:'character',
				sort:'distance'
			});
			if( targets.length)
			{
				var en = targets[0];
				$.ps.x = en.ps.x - 120*($.dirh());
				$.ps.y = 0;
				$.ps.z = en.ps.z;
			}
			break;
		}
	}

	livingobject.prototype.handle_catching_state = function(event, K)
	{
		var $=this;
		switch (event) {
			case 'state_entry':
				$.statemem.stateTU=true;
				$.statemem.counter=GC.default.cpoint.decreaseTime;
				$.statemem.attacks=0;
				$.ps.vx = 0;
				$.ps.vy = 0;
				$.ps.vz = 0;
			break;

			case 'state_exit':
				$.catching=null;
				$.ps.zz=0;
			break;

			case 'frame':
				 switch ($.frame.N)
				 {
					 case 123: //a successful attack
						$.statemem.attacks++;
					 	break;
					 case 233: case 234:
					 	$.trans.inc_wait(-1);
					 	break;
				 }
				if( $.catching && $.frame.D.cpoint)
				{
					$.catching.caught_b(
						$.mech.make_point($.frame.D.cpoint),
						$.frame.D.cpoint,
						$.ps.dir,
						$.dirv()
					);
					if($.frame.D.cpoint.injury)
					{
						$.catching.injury($.frame.D.cpoint.injury);
						$.effect_stuck(0,1);
					}
					//decrase: positive and negative values decrease counter, but a catch can only end if decrease value is negative in this frame
					if($.frame.D.cpoint.decrease)
					{
						$.statemem.counter -= Math.abs($.frame.D.cpoint.decrease);
						if($.frame.D.cpoint.decrease < 0 && $.statemem.counter < 0)
						{
							$.catching.caught_release();
							$.trans.frame(999,0);
						}
					}
				}
			break;

			case 'TU':
			if( $.catching &&
				$.caught_cpointkind()===1 &&
				$.catching.caught_cpointkind()===2 )
			{	//really catching you
				if( $.statemem.stateTU)
				{	$.statemem.stateTU=false;
					/**the immediate `TU` after `state`. the reason for this is a synchronization issue,
						i.e. it must be waited until both catcher and catchee transited to the second frame
						and it is not known at the point of `frame` event, due to different scheduling.
					 */

					//injury
					if( $.frame.D.cpoint.injury)
					{
						if( $.attacked($.catching.hit($.frame.D.cpoint, $, {x:$.ps.x,y:$.ps.y,z:$.ps.z}, null)))
							$.trans.inc_wait(1, 10, 99); //lock until frame transition
					}
					//cover
					var cover = GC.default.cpoint.cover;
					if( $.frame.D.cpoint.cover!==undefined) cover=$.frame.D.cpoint.cover;
					if( cover===0 || cover===10 )
						$.ps.zz=1;
					else
						$.ps.zz=-1;

					if( $.frame.D.cpoint.dircontrol===1)
					{
						if($.con.state.left) $.switch_dir('left');
						if($.con.state.right) $.switch_dir('right');
					}
				}
			}
			break; //TU
			
			case 'combo':
			switch(K)
			{
				case 'att':
					if( $.frame.D.cpoint &&
						($.frame.D.cpoint.taction ||
						$.frame.D.cpoint.aaction))
					{
						var dx = $.con.state.left !== $.con.state.right;
						var dy = $.con.state.up   !== $.con.state.down;
						if( (dx || dy) && $.frame.D.cpoint.taction)
						{
							var tac = $.frame.D.cpoint.taction;
							if( tac<0)
							{	//turn myself around
								$.switch_dir($.ps.dir==='right'?'left':'right'); //toogle dir
								$.trans.frame(-tac, 10);
							}
							else
							{
								$.trans.frame(tac, 10);
							}
							$.statemem.counter+=10;
						}
						else if($.frame.D.cpoint.aaction)
							$.trans.frame($.frame.D.cpoint.aaction, 10);
						var nextframe=$.data.frame[$.trans.next()];
						$.catching.caught_throw(nextframe.cpoint, $.dirv());
					}
				return 1; //always return true so that `att` is not re-fired next frame
				case 'jump':
					if( $.frame.N===121)
					if($.frame.D.cpoint.jaction)
					{
						$.trans.frame($.frame.D.cpoint.jaction, 0);
						return 1;
					}
				break;
			}
			break;
		}
	}

	livingobject.prototype.hit_ground = function()
	{
	}

	livingobject.prototype.dirv = function()
	{
		var $=this;
		var d=0;
		if( $.con)
		{
			if( $.con.state.up)   d-=1;
			if( $.con.state.down) d+=1;
		}
		return d;
	}

	livingobject.prototype.proper = function(id,prop)
	{
		var $=this;
		if( arguments.length===1)
		{
			prop=id;
			id=$.id;
		}
		if( $.match.spec.ID[id] && $.match.spec.ID[id][prop] != null)
			return $.match.spec.ID[id][prop];
		var obj = $.match.data.object.find(elem => elem.id === id)
		if(obj != null && obj.type != null) {
			return $.match.spec.TYPE[obj.type][prop]
		} 
		return undefined;
	}

	livingobject.prototype.caught_cpointkind=function()
	{
		var $=this;
		return $.frame.D.cpoint ? $.frame.D.cpoint.kind:0;
	}

	
	/** inter-living objects protocol: catch & throw
		for details see http://f-lf2.blogspot.hk/2013/01/inter-living-object-interactions.html
	 */
	livingobject.prototype.caught_a=function(ITR, att, attps)
	{	//this is called when the catcher has an ITR with kind: 1 or 3
		var $=this;
		if( (ITR.kind===1 && $.state()===16) //I am in dance of pain
		 || (ITR.kind===3)) //that is a super catch 
		{
			if( (attps.x > $.ps.x)===($.ps.dir==='right'))
				$.trans.frame(ITR.caughtact[0], 22);
			else
				$.trans.frame(ITR.caughtact[1], 22);
			$.health.fall=0;
			$.catching=att;
			$.itr.attacker=att;
			$.drop_weapon();
			return (attps.x > $.ps.x)===($.ps.dir==='right') ? 'front':'back';
		}
	}
	livingobject.prototype.caught_b=function(holdpoint,cpoint,adir,vdir)
	{	//this is called when the catcher has a cpoint with kind: 1
		var $=this;
		$.caught_b_holdpoint=holdpoint;
		$.caught_b_cpoint=cpoint;
		$.caught_b_adir=adir;
		$.caught_b_vdir=vdir;
		//store this info and process it at TU
	}
	livingobject.prototype.caught_cpointhurtable=function()
	{
		var $=this;
		if( $.frame.D.cpoint && $.frame.D.cpoint.hurtable!==undefined)
			return $.frame.D.cpoint.hurtable;
		else
			return GC.default.cpoint.hurtable;
	}
	livingobject.prototype.caught_throw=function(cpoint,vdir)
	{	//I am being thrown
		var $=this;
		if( cpoint.vaction!==undefined)
			$.trans.frame(cpoint.vaction, 22);
		else
			$.trans.frame(GC.default.cpoint.vaction, 22);
		$.caught_throwz = vdir;
	}
	livingobject.prototype.caught_release=function()
	{
		var $=this;
		$.catching=0;
		$.trans.frame(181,22);
		$.effect.dvx=3; //magic number
		$.effect.dvy=-3;
		$.effect.timein=-1;
		$.effect.timeout=0;
	}

	function frame_transistor($)
	{
		var wait=1; //when wait decreases to zero, a frame transition happens
		var next=999; //next frame
		var lock=0;
		var lockout=1; //when lockout equals 0, the lock will be reset automatically
		//frame transitions are caused differently: going to the next frame, a combo is pressed, being hit, or being burnt
		//  and they can all happen *at the same TU*, to determine which frame to go to,
		//  each cause is given an authority which is used to resolve frame transition conflicts.
		//  lock=0 means unlocked
		//  common authority values:
		//  0: natural
		// 10: move,defend,jump,punch,catching,caught
		// 11: special moves
		// 15: environmental interactions
		// 2x: interactions
		//    20: being punch
		//    21: fall
		// 3x: strong interactions
		//    30: in effect type 0
		//    35: blast
		//    36: fire
		//    38: ice
		var switch_dir_after_trans; //a negative next value causes a switch dir after frame transition

		this.frame=function(F,au)
		{
			//console.log('frame', F, au, arguments.callee.caller.toString()) //trace caller
			this.set_next(F,au);
			this.set_wait(0,au);
		}

		this.set_wait=function(value,au,out)
		{
			if(!au) au=0; //authority
			if( au===99) au=lock; //au=99 means always has just enough authority
			if(!out) out=1; //lock timeout
			if( au >= lock)
			{
				lock=au;
				lockout=out;
				if( out===99) //out=99 means lock until frame transition
					lockout=wait;
				wait=value;
				if( wait<0) wait=0;
			}
		}

		this.inc_wait=function(inc,au,out) //increase wait by inc amount
		{
			if(!au) au=0;
			if( au===99) au=lock;
			if(!out) out=1;
			if( au >= lock)
			{
				lock=au;
				lockout=out;
				if( out===99)
					lockout=wait;
				wait+=inc;
				if( wait<0) wait=0;
			}
		}

		this.next=function()
		{
			return next;
		}
		this.wait=function()
		{
			return wait;
		}

		this.set_next=function(value,au,out)
		{
			if(!au) au=0;
			if( au===99) au=lock;
			if(!out) out=1;
			if( au >= lock)
			{
				lock=au;
				lockout=out;
				if( out===99)
					lockout=wait;
				if( value<0)
				{
					value=-value;
					switch_dir_after_trans=true;
				}
				next=value;
			}
		}

		this.reset_lock=function(au)
		{
			if(!au) au=0;
			if( au===99) au=lock;
			if( au >= lock)
			{
				lock=0;
			}
		}

		this.next_frame_D=function()
		{
			var anext = next;
			if( anext===999)
				anext=0;
			return $.data.frame[anext];
		}

		this.trans=function()
		{
			var oldlock=lock;
			lockout--;
			if( lockout===0)
				lock=0; //reset transition lock

			if( wait===0)
			{
				if( next===0)
				{
					//do nothing
				}
				else
				{
					if( next===1000)
					{
						$.state_update('destroy');
						$.match.destroy_object($);
						return;
					}
					if( $.health.hp<=0 && $.frame.D.state===14)
						return;

					if( next===999 && $.ps.y!==0 && $.ps.vy!==0 && $.player)	//check if in air and if not a weapon 
						next=212;
					else if( next===999)
						next = 0;
					$.frame.PN=$.frame.N;
					$.frame.N=next;
					$.state_update('frame_exit');

					//state transition
					var is_trans = $.frame.D.state !== $.data.frame[next].state;
					if( is_trans)
						$.state_update('state_exit');

					$.frame.D=$.data.frame[next];

					if( is_trans)
					{
						for( var I in $.statemem)
							$.statemem[I] = undefined;
						var old_switch_dir=$.allow_switch_dir;
						if( $.states_switch_dir && $.states_switch_dir[$.frame.D.state] !== undefined)
							$.allow_switch_dir=$.states_switch_dir[$.frame.D.state];
						else
							$.allow_switch_dir=false;

						$.state_update('state_entry');

						if(!switch_dir_after_trans)
						if( $.allow_switch_dir && !old_switch_dir)
						{
							if( $.con)
							{
								if($.con.state.left) $.switch_dir('left');
								if($.con.state.right) $.switch_dir('right');
							}
						}
					}

					if( switch_dir_after_trans)
					{
						switch_dir_after_trans=false;
						$.switch_dir($.ps.dir==='right'?'left':'right');
					}

					$.frame_update();

					if( oldlock===10 || oldlock===11) //combo triggered action
						if( wait>0)
							wait-=1;
				}
			}
			else
				wait--;
		}
	} // frame_transistor

	return livingobject;
});
