"""Generate the illustrated source guide. Requires reportlab; run from any directory."""
from pathlib import Path
import hashlib, html, json, re
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Flowable, KeepTogether, Table, TableStyle
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'docs/code-review/GroupPortfolio_Feature_Code_Review.pdf'
NOTES=json.loads((ROOT/'docs/code-review/source-notes.json').read_text(encoding='utf-8'))
W=509
INK=colors.HexColor('#163847'); TEAL=colors.HexColor('#137C80'); BLUE=colors.HexColor('#2876A5'); AMBER=colors.HexColor('#D78C29')
PALE=colors.HexColor('#EFF6F6'); GRAY=colors.HexColor('#566D76')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='ReviewTitle',fontName='Helvetica-Bold',fontSize=23,leading=27,textColor=INK,spaceAfter=12))
styles.add(ParagraphStyle(name='ReviewSub',fontName='Helvetica-Bold',fontSize=11,leading=14,textColor=TEAL,spaceBefore=9,spaceAfter=6,keepWithNext=True))
styles.add(ParagraphStyle(name='ReviewBullet',fontName='Helvetica',fontSize=10,leading=13.5,spaceAfter=6,leftIndent=12,bulletIndent=0))
styles.add(ParagraphStyle(name='ReviewRef',fontName='Helvetica',fontSize=8,leading=10,textColor=GRAY,spaceAfter=4,leftIndent=12))
styles.add(ParagraphStyle(name='ReviewCaption',fontName='Helvetica',fontSize=9,leading=12,textColor=GRAY,spaceAfter=9))
styles.add(ParagraphStyle(name='ReviewCell',fontName='Helvetica',fontSize=9,leading=12,textColor=INK))
story=[]
def p(text,style='ReviewBullet'):return Paragraph(html.escape(text),styles[style])
def bullet(label,text):return Paragraph('<b>'+html.escape(label)+'</b> '+html.escape(text),styles['ReviewBullet'],bulletText='\u2022')
def start(title,subtitle):
    if story:story.append(PageBreak())
    story.extend([p('GROUP PORTFOLIO / ILLUSTRATED CODE REVIEW','ReviewSub'),p(title,'ReviewTitle'),p(subtitle,'ReviewCaption'),Spacer(1,5)])
def ref(file,*symbols):
    lines=(ROOT/file).read_text(encoding='utf-8-sig').splitlines();locations=[]
    for symbol in symbols:
        hits=[(n+1,line) for n,line in enumerate(lines) if re.search(re.escape(symbol)+r'\s*\(',line)]
        declarations=[(n,line) for n,line in hits if re.search(r'^\s*(?:(?:public|private|protected|static|synchronized|final|async)\s+)*(?:[\w<>?,.\[\]]+\s+)?'+re.escape(symbol)+r'\s*\(',line)]
        if not hits:raise ValueError(f'Missing function: {file} {symbol}')
        locations.append(f'{symbol}() L{(declarations or hits)[0][0]}')
    display=file.replace('src/main/resources/static/','').replace('src/main/java/com/aet/portfolio/','java/').replace('src/main/resources/','resources/')
    return p(display+' - '+', '.join(locations),'ReviewRef')

class Visual(Flowable):
    def __init__(self,mode,height):super().__init__();self.width=W;self.height=height;self.mode=mode
    def arrow(self,x,y,x2,y2,color=GRAY):
        c=self.canv;c.setStrokeColor(color);c.setLineWidth(1.5);c.line(x,y,x2,y2)
        import math
        a=math.atan2(y2-y,x2-x)
        for d in [-.45,.45]:c.line(x2,y2,x2-7*math.cos(a+d),y2-7*math.sin(a+d))
    def box(self,x,y,w,h,title,lines=(),accent=TEAL):
        c=self.canv;c.setFillColor(colors.white);c.setStrokeColor(colors.HexColor('#CCDCDD'));c.roundRect(x,y,w,h,9,fill=1,stroke=1)
        c.setFillColor(accent);c.roundRect(x,y,w,5,2,fill=1,stroke=0)
        s=ParagraphStyle('label',fontName='Helvetica-Bold',fontSize=11,leading=13,textColor=INK)
        titlep=Paragraph(html.escape(title),s);tw,th=titlep.wrap(w-24,h-16);titlep.drawOn(c,x+12,y+h-12-th)
        cursor=y+h-19-th
        for line in lines:
            q=Paragraph(html.escape(line),ParagraphStyle('line',fontName='Helvetica',fontSize=9.5,leading=12,textColor=GRAY))
            qw,qh=q.wrap(w-24,100);q.drawOn(c,x+12,cursor-qh);cursor-=qh+4
    def draw(self):
        c=self.canv
        c.setFillColor(PALE);c.roundRect(0,0,W,self.height,12,fill=1,stroke=0)
        getattr(self,'draw_'+self.mode)()
    def draw_repository(self):
        self.box(148,438,213,58,'GroupPortfolio',['pom.xml + Maven wrappers'])
        self.arrow(220,438,125,408);self.arrow(290,438,385,408)
        self.box(10,208,239,195,'Spring backend',[
            'src/main/java/com/aet/portfolio/',
            'config/ - validate settings', 'controller/ - receive HTTP requests',
            'service/ - apply data rules', 'storage/ - safely save JSON', 'model/ - describe data objects'])
        self.box(260,208,239,195,'Browser UI',[
            'src/main/resources/static/', 'js/core/ - startup and API calls',
            'js/classroom/ - room and experiences', 'js/portfolio/ - books and music',
            'js/phone/ - phone apps', 'js/intro/ + js/shared/ - common UI'],AMBER)
        self.box(10,105,239,92,'Content and configuration',[
            'src/main/resources/', 'application.* + data/members.json'])
        self.box(260,105,239,92,'Assets and libraries',[
            'static/css/ + static/assets/', 'static/vendor/ + static/dev/'],AMBER)
        self.box(10,10,239,84,'Tests and docs',['src/test/ + scripts/verification/', 'docs/architecture/ + docs/design/'])
        self.box(260,10,239,84,'Runtime and generated data',['var/data/ - saved visitor data', 'target/ + .verification/ - generated'],AMBER)
    def draw_spring(self):
        self.box(15,290,214,82,'1. Browser asks for data',['main.js -> API.getMembers()', 'GET /api/members'],BLUE)
        self.box(280,290,214,82,'2. Spring controller',['MemberController.getAllMembers()', 'Maps a URL to a Java function'])
        self.arrow(229,337,280,337,BLUE);self.arrow(280,309,229,309,TEAL)
        self.box(280,175,214,82,'3. Spring service',['MemberService.getAllMembers()', 'Returns loaded member objects'])
        self.arrow(387,290,387,257)
        self.box(15,175,214,82,'Configuration follows a similar path',['application.yml -> SiteProperties', 'ClassroomController -> classroom JSON'])
        self.box(280,60,214,82,'4. Source data',['data/members.json', 'Loaded at startup with ObjectMapper'],AMBER)
        self.arrow(387,142,387,175,AMBER)
        self.box(15,60,214,82,'5. Browser draws the feature',['JSON -> DeskScene -> ClearBook', 'Three.js + DOM + CSS + GSAP'],BLUE)
        self.arrow(280,215,229,101,BLUE)
        c=self.canv;c.setFont('Helvetica',9);c.setFillColor(GRAY);c.drawString(18,25,'Blue = browser    Teal = Spring Java    Amber = files and assets')
    def chain(self,steps):
        coords=[(15,260),(280,260),(280,140),(15,140),(15,20),(280,20)]
        for i,(title,lines,color) in enumerate(steps):
            x,y=coords[i];self.box(x,y,214,90,title,lines,color)
        for a,b in zip(coords,coords[1:len(steps)]):
            x,y=a;u,v=b
            if y==v:
                if u>x:self.arrow(x+214,y+45,u,v+45)
                else:self.arrow(x,y+45,u+214,v+45)
            else:self.arrow(x+107,y,u+107,v+90)
    def draw_notebook(self):
        self.chain([
            ('1. Write the member content',['data/members.json','deskItem: spiral-notebook'],AMBER),
            ('2. Load it through Spring',['MemberService.loadMembers()','MemberController -> member JSON'],TEAL),
            ('3. Build a clickable notebook',['DeskScene.buildFolders()','createSpiralNotebook(member)'],BLUE),
            ('4. Select the desk item',['DeskScene.selectFolder()','Callbacks in core/main.js'],BLUE),
            ('5. Build the inside pages',['ClearBook.open() + renderPages()','Titles, content, photos, and borders'],BLUE),
            ('6. Flip the pages',['nextPage() -> turnSpiral()','CSS/GSAP animate the saved nodes'],BLUE)])
    def draw_guestbook(self):
        self.chain([
            ('1. Visitor fills in the form',['setupGuestbook()','Text + author + member ID'],BLUE),
            ('2. Browser sends JSON',['API.postNote()','POST /api/members/{id}/notes'],BLUE),
            ('3. Controller checks request',['NoteController.addNote()','Member exists? Payload valid?'],TEAL),
            ('4. Service applies rules',['NoteService.addNote()','Trim, length limits, HTML escaping'],TEAL),
            ('5. File store saves first',['JsonFileStore.write()','Temporary file -> replacement'],TEAL),
            ('6. Return the saved note',['Service cache updates after saving','201 JSON -> browser adds a 3D note','Default file: var/data/notes.json'],AMBER)])
    def draw_phone(self):
        c=self.canv
        c.setFillColor(colors.HexColor('#E9B54D'));c.setStrokeColor(INK);c.setLineWidth(2);c.roundRect(18,12,158,270,20,fill=1,stroke=1)
        c.setFillColor(colors.HexColor('#F8D677'));c.roundRect(24,18,146,258,16,fill=1,stroke=1)
        c.setFillColor(INK);c.roundRect(77,261,41,8,4,fill=1,stroke=0)
        for i in range(3):c.rect(33+i*4,260,2.8,4+i*3,fill=1,stroke=0)
        c.setFillColor(colors.HexColor('#8BB66D'));c.rect(147,261,13,6,fill=1,stroke=1);c.setFillColor(INK);c.rect(160,263,2,2,fill=1,stroke=0)
        c.setFillColor(colors.HexColor('#42B86B'));c.circle(63,218,19,fill=1,stroke=1)
        c.setStrokeColor(INK);c.setLineWidth(2);c.line(64,209,64,231);c.line(64,231,75,234);c.line(75,234,75,213);c.ellipse(55,205,64,211,fill=0,stroke=1);c.ellipse(66,209,75,215,fill=0,stroke=1)
        path=c.beginPath();path.moveTo(123,203);path.curveTo(90,222,108,248,123,232);path.curveTo(138,248,156,222,123,203);c.drawPath(path,stroke=1,fill=0)
        c.setFillColor(INK);c.setFont('Helvetica-Bold',10);c.drawCentredString(63,186,'SpotiBai');c.drawCentredString(127,186,'Labibi')
        self.box(205,210,288,70,'Status stays inside the display',['phone-screen contains phone-status,','the app header, and phone-content.'],BLUE)
        self.box(205,120,288,72,'Home screen has no Phone heading',['showHome() hides the header; app names','such as SpotiBai remain visible.'],BLUE)
        self.box(205,25,288,72,'TMA starts at 0:30',['SPOTIBAI_START_SECONDS.tma = 30','playTrack() seeks before starting playback.'],AMBER)
        self.arrow(205,245,171,265);self.arrow(205,156,170,246)
    def draw_zerog(self):
        c=self.canv
        for x,lift,label in [(14,0,'Normal classroom'),(270,30,'Zero-G classroom')]:
            self.box(x,30,225,180,label,[],BLUE)
            c.setStrokeColor(GRAY);c.line(x+15,52,x+210,52)
            c.setFillColor(colors.HexColor('#D49A4F'));c.rect(x+27,80+lift,115,10,fill=1,stroke=1)
            c.rect(x+32,53+lift,6,27,fill=1,stroke=1);c.rect(x+131,53+lift,6,27,fill=1,stroke=1)
            for px,py in [(x+61,108+lift),(x+177,85+lift)]:
                c.setFillColor(colors.HexColor('#D69A6B'));c.circle(px,py+17,10,fill=1,stroke=1)
                c.setFillColor(colors.HexColor('#2E9C8F'));c.roundRect(px-12,py-15,24,22,4,fill=1,stroke=1)
            if lift:self.arrow(x+186,65,x+186,105,AMBER)
        self.arrow(240,124,268,124,AMBER)
        c.setFont('Helvetica',9);c.setFillColor(GRAY);c.drawString(20,10,'Save original poses -> lift the contents -> restore exact poses. The building stays anchored.')
    def draw_spring_basics(self):
        self.box(20,228,469,85,'Our application code',[
            'PortfolioApplication + controllers + services + models',
            'The team writes portfolio content, validation rules, storage, and the UI.'],BLUE)
        self.box(20,119,469,83,'Spring Framework: the application foundation',[
            'Connects Java objects, routes HTTP requests, and supports configuration.',
            'In our website, Spring MVC connects browser URLs to controller functions.'])
        self.box(20,10,469,83,'Spring Boot: simpler setup for Spring',[
            'Starter dependencies + sensible automatic configuration + embedded server',
            'pom.xml selects Boot 3.3.4; PortfolioApplication.main() starts it.'],AMBER)
        self.arrow(254,93,254,119,AMBER);self.arrow(254,202,254,228,TEAL)
    def draw_spring_paths(self):
        self.box(15,270,214,102,'1. Browser asks for members',[
            'src/main/resources/static/', 'js/core/api.js',
            'API.getMembers() -> GET /api/members'],BLUE)
        self.box(280,270,214,102,'2. Controller receives the URL',[
            'src/main/java/com/aet/portfolio/', 'controller/MemberController.java',
            'getAllMembers() handles the request'])
        self.arrow(229,321,280,321,BLUE)
        self.box(280,135,214,105,'3. Service returns loaded data',[
            'src/main/java/com/aet/portfolio/', 'service/MemberService.java',
            'getAllMembers() reads the memory list'])
        self.arrow(387,270,387,240)
        self.box(15,135,214,105,'Startup source for that list',[
            'src/main/resources/', 'data/members.json',
            'loadMembers() + ObjectMapper load it once'],AMBER)
        self.arrow(229,188,280,188,AMBER)
        self.box(15,12,479,88,'4. Spring returns JSON; the browser renders the feature',[
            'Controller result -> Spring MVC / Jackson -> HTTP JSON response',
            'js/core/main.js -> js/classroom/scene.js -> js/portfolio/book.js'],BLUE)
        self.arrow(387,135,387,100,TEAL)

class ReviewDoc(SimpleDocTemplate):
    def afterFlowable(self,flowable):
        if isinstance(flowable,Paragraph) and flowable.style.name=='ReviewTitle':
            title=flowable.getPlainText()
            if title in ['UI features, explained through source code','Contents']:return
            key='section-'+hashlib.sha1(title.encode()).hexdigest()[:12]
            self.canv.bookmarkPage(key);self.canv.addOutlineEntry(title,key,0,False)
            self.notify('TOCEntry',(0,title,self.page,key))

def feature(section):
    start(section['title'],section['subtitle'])
    items=section['items'];i=0
    while i<len(items):
        item=items[i];kind=item['kind'];args=item['args']
        if kind=='bullet':
            group=[bullet(*args)];i+=1
            while i<len(items) and items[i]['kind']=='ref':group.append(ref(*items[i]['args']));i+=1
            story.append(KeepTogether(group));continue
        if kind=='sub':story.append(p(args[0],'ReviewSub'))
        elif kind=='ref':story.append(ref(*args))
        else:story.append(p(args[0],'ReviewRef'))
        i+=1

feature(NOTES[0])
start('Contents','Click a section title or use your PDF reader\'s bookmarks to jump to a feature.')
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Helvetica',fontSize=9,leading=10,leftIndent=0,firstLineIndent=0,spaceBefore=0,textColor=INK)]
story.append(toc)

start('Spring explained / What Spring means','Beginner explanation grounded in the Java code used by this project.')
story.append(Visual('spring_basics',328));story.append(Spacer(1,12))
for label,text in [
('Spring is a Java framework:', 'A framework supplies reusable infrastructure and a structure for your application. Spring manages Java objects and, through Spring MVC, helps turn HTTP requests into calls to your Java methods.'),
('Spring Boot makes Spring easier to start:', 'Our project uses Spring Boot 3.3.4. Its starters bring compatible dependencies, auto-configuration sets up common web components, and an embedded server runs the site from the Java application.'),
('In this website:', 'Spring serves the HTML/CSS/JavaScript and the JSON API. The browser fetches member/classroom data and uses it to build the interactive UI.'),
('Our code still owns the features:', 'We wrote the Three.js classroom, book engine, phone apps, custom note rules, and JSON-file storage. Spring connects and hosts these parts; it does not generate their behavior.'),
('Presentation sentence:', '"Spring is the Java foundation of our server, and Spring Boot handles much of the setup so we can focus on our portfolio features."')]:story.append(bullet(label,text))
story.append(ref('src/main/java/com/aet/portfolio/PortfolioApplication.java','main'))
story.append(p('Project root: C:\\workspace\\GroupPortfolio | Spring dependencies: pom.xml','ReviewRef'))

start('Spring explained / How it simplified our work','These are infrastructure tasks Spring handles or reduces in this actual project.')
comparison=[['Task','What Spring / Boot supplies','Where to see it in our repo'],
['Start a web server','Boot starts an embedded server and configures the web application. We do not deploy to a separate server manually.','pom.xml; java/PortfolioApplication.java'],
['Connect a URL to Java','Spring MVC selects the annotated controller method. We do not write low-level HTTP routing for every URL.','java/controller/MemberController.java; NoteController.java'],
['Connect collaborating classes','Spring creates managed services/components and supplies them through constructors.','java/controller/MemberController.java; java/service/MemberService.java'],
['Read/write HTTP JSON','Spring MVC integrates Jackson to read request bodies and serialize returned objects/maps. Our services also use the injected ObjectMapper.','java/controller/NoteController.java; java/service/MemberService.java'],
['Serve the website assets','Boot/Spring resource handling serves index.html, CSS, JS, fonts, and media from static/.','resources/static/; resources/application.properties'],
['Load and validate settings','Spring binds site.* values into SiteProperties; validation rejects invalid supported settings. We still write the constraints.','resources/application.yml; java/config/SiteProperties.java'],
['Test the backend','starter-test and MockMvc let tests call controllers and assert HTTP responses through Spring.','pom.xml; src/test/java/com/aet/portfolio/']]
cells=[[p(value,'ReviewCell') for value in row] for row in comparison]
table=Table(cells,colWidths=[85,245,179],hAlign='LEFT')
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#CCDCDD')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
story.append(table);story.append(Spacer(1,10))
story.append(bullet('Path key:', 'java/ means src/main/java/com/aet/portfolio/. resources/ means src/main/resources/. The next page shows complete project-relative paths inside a request diagram.'))
story.append(bullet('The practical benefit:', 'One Java application serves the UI and API, exposes annotated endpoints, shares managed services, and reads configuration. The team spends less time assembling common server infrastructure.'))
story.append(bullet('What remains our responsibility:', 'JsonFileStore implements our save strategy; NoteService implements our note rules. Spring does not automatically add a database or make these custom file operations transactional.'))

start('Spring explained / Follow the folder paths','Every path below starts inside C:\\workspace\\GroupPortfolio. Combine the path lines in each box.')
story.append(Visual('spring_paths',387));story.append(Spacer(1,12))
for label,text in [
('Find the startup file:', 'src/main/java/com/aet/portfolio/PortfolioApplication.java contains @SpringBootApplication and SpringApplication.run(). This starts the Spring context and application.'),
('Find the URL mapping:', 'MemberController uses @RestController, @RequestMapping("/api/members"), and @GetMapping. Spring matches the URL, calls getAllMembers(), then serializes its return value as JSON.'),
('Find constructor injection:', 'The MemberController constructor accepts MemberService and ObjectMapper. Spring supplies these managed objects. The controller then calls memberService.getAllMembers().'),
('Find the startup hook:', 'MemberService is annotated @Service. Its @PostConstruct init() calls loadMembers(), which reads the packaged JSON into memory. A normal GET request reuses that loaded list.'),
('Find the configuration:', 'src/main/resources/application.properties sets the port/static location. src/main/resources/application.yml supplies site settings bound by src/main/java/com/aet/portfolio/config/SiteProperties.java.')]:story.append(bullet(label,text))
story.append(ref('src/main/java/com/aet/portfolio/controller/MemberController.java','MemberController','getAllMembers'))
story.append(ref('src/main/java/com/aet/portfolio/service/MemberService.java','init','loadMembers','getAllMembers'))

start('Visual map / Where the code lives','Start here when you need to find a file. The folder names reflect the current repository.')
story.append(Visual('repository',510));story.append(Spacer(1,10))
story.append(bullet('Read it as two halves:','Java handles the server and shared data. The browser folders handle the classroom, books, phone, styling, and movement.'))
story.append(bullet('Keep generated files separate:','Edit src and docs. target is build output; var/data is visitor data; .verification contains check results.'))

start('Visual map / How Spring reaches the UI','One worked example: obtaining member data and showing a portfolio.')
story.append(Visual('spring',390));story.append(Spacer(1,12))
story.append(bullet('Plain-language explanation:','The browser asks a URL for content. Spring selects a controller function, the controller uses a service, and the result becomes JSON. JavaScript uses that JSON to draw the feature.'))
story.append(bullet('What dependency injection means:','Spring creates and connects the controller, service, ObjectMapper, and file-store objects through their constructors.'))
story.append(bullet('Static files also come from Spring:','The same application serves index.html, CSS, JavaScript, fonts, and media, so the normal browser/API flow shares one origin.'))

start('Visual example / Notebook to functions','Use this page to explain how a visible notebook comes from source code.')
story.append(Visual('notebook',365));story.append(Spacer(1,12))
story.append(bullet('The content comes from JSON:','Member 1 has deskItem="spiral-notebook". Its name, text, photo, cover color, and page list determine what gets rendered.'))
story.append(bullet('The appearance comes from browser code:','classroom/scene.js draws the closed notebook; portfolio/book.js builds the readable page overlay; book.css styles it; turnSpiral() animates the turn.'))
story.append(bullet('Spring\'s role:','MemberService loads the content and MemberController exposes it. Spring also supplies optional notebook music and available photo filenames.'))
story.append(ref('src/main/resources/static/js/classroom/scene.js','createSpiralNotebook','selectFolder'))
story.append(ref('src/main/resources/static/js/portfolio/book.js','open','renderPages','turnSpiral'))

start('Visual example / Saving a guestbook note','This is the clearest full-stack path: browser form, Spring validation, saved file, and 3D response.')
story.append(Visual('guestbook',365));story.append(Spacer(1,12))
story.append(bullet('Why the file store matters:','It writes a temporary sibling file before replacing the saved JSON. NoteService publishes the new note to its cache only after saving succeeds.'))
story.append(bullet('What happens on failure:','The controller returns an error. An unsaved note is not shown as a successful new message; the previous saved file/cache is retained.'))
story.append(bullet('Browser-local versus server data:','Guestbook notes are server files. Whiteboard drawings use localStorage in that browser; page turns and Zero-G are temporary UI state.'))
story.append(ref('src/main/java/com/aet/portfolio/storage/JsonFileStore.java','write'))

start('Visual update / Phone and notice card','The latest UI requests are included in this edition.')
story.append(Visual('phone',294));story.append(Spacer(1,10))
story.append(ref('src/main/resources/static/js/phone/phone.js','build','showHome','showSpotiBai'))
story.append(ref('src/main/resources/static/js/classroom/experiences.js','playTrack'))
story.append(p('Noticeboard: Rules ni Boy Bestfriend','ReviewSub'))
rules=[
'1. Ayukong lalabas ka ng nakasando na kita ang bra mo.',
'2. Ayukong magagala na ng subrang igsi ng short mo at wala ka pang cycling.',
'3. Wag na wag kang magbibisyo.',
'4. Ayukong lage kang nagpupuyat sa walang kwentang dahilan.']
for rule in rules:story.append(p(rule))
story.append(bullet('Implementation:','buildSurroundingRoom() renders a 2048 x 1120 noticeboard texture and measures words to wrap the four rules inside the card. The other two cards keep their existing content.'))
story.append(ref('src/main/resources/static/js/classroom/scene.js','buildSurroundingRoom'))

start('Visual update / Whole-classroom Zero-G','Floating now covers the classroom contents, with a safe and repeatable reset.')
story.append(Visual('zerog',230));story.append(Spacer(1,12))
for label,text in [
('Gather:', 'getFloatingObjects() includes people, chairs, teacher, displays, curtains, fans, bags, wrappers, basketball, banner, and desk. The last browser check exercised 47 floating assemblies.'),
('Keep parts together:', 'groupFloatingObjects() groups related geometry, artwork, and invisible click targets, so they do not drift apart.'),
('Save and lift:', 'snapshotAntiGravityHomes() saves the original transforms/materials; triggerAntiGravity() creates GSAP lift and gentle rotation tweens.'),
('Restore:', 'stopAntiGravity() lands the assemblies, and finishAntiGravityReset() copies exact original values. Rapid toggles finish a pending reset before taking the next snapshot.'),
('Reduce motion:', 'Reduced-motion users get a simple lift and immediate reset. The floor, walls, ceiling, outside view, and camera remain anchored.'),
('Cartoon cursor:', 'css/cursor.css uses large 48 px arrow / 52 px glove SVGs in assets/cursors. Native cursor images stay responsive without a JavaScript follower.')]:story.append(bullet(label,text))
story.append(ref('src/main/resources/static/js/classroom/scene.js','getFloatingObjects','snapshotAntiGravityHomes','triggerAntiGravity','stopAntiGravity','finishAntiGravityReset'))

for section in NOTES[1:]:feature(section)

def footer(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(colors.HexColor('#D4DFE1'));canvas.line(43,40,A4[0]-43,40)
    canvas.setFont('Helvetica',8);canvas.setFillColor(GRAY);canvas.drawString(43,27,'Group Portfolio | Updated illustrated guide | 21 Nov 2026')
    canvas.drawRightString(A4[0]-43,27,str(doc.page));canvas.restoreState()

OUTPUT.parent.mkdir(parents=True,exist_ok=True)
doc=ReviewDoc(str(OUTPUT),pagesize=A4,leftMargin=43,rightMargin=43,topMargin=31,bottomMargin=52,title='Group Portfolio - Illustrated Feature and Source Code Guide',author='Group Portfolio Documentation',pageCompression=1)
doc.multiBuild(story,onFirstPage=footer,onLaterPages=footer)
print(OUTPUT)
