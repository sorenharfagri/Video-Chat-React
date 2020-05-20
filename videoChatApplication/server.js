const express = require('express')

var io = require('socket.io')
({
  path: '/io/webrtc'
})

const app = express()
const port = process.env.PORT || 8080;

const rooms = {}; //Здесь будем хранить комнаты

//Отдаём react с помощью ноды
app.use(express.static(__dirname + '/build'))

app.get('/', (req, res, next) => { //Стандартная комната
    res.sendFile(__dirname + '/build/index.html')
});

app.get('/:room', (req, res, next) => { //Кастомная комната
  res.sendFile(__dirname + '/build/index.html')
});



const server = app.listen(port, () => console.log(`Server started on port: ${port}`))

io.listen(server)


io.on('connection', socket => {
  console.log('connected')
})

//Пространство имён для сокетов
const peers = io.of('/webrtcPeer')


//Работа с сокетами
peers.on('connection', socket => {

  //Получаем комнату с объекта query
  const room = socket.handshake.query.room;
  
  //Добавляем комнату в объект комнат
  //Так-же проверяем, возможно комната уже существует
  //В таком случае добавляем в неё соединение
  //Если комнаты не существует - создаём
  rooms[room] = rooms[room] && rooms[room].set(socket.id, socket) || (new Map()).set(socket.id, socket)


  console.log(socket.id)

  //Отправляем новому пользователю данные о количестве соединений
  //Количество будет отображено в интерфейсе
  socket.emit('connection-success', {  
    success: socket.id,
    peerCount: rooms[room].size,
  })


  //Уведомляем текущих пользователей о том, что количество соединений увеличилось, для отображения в ui
  const broadcast = () => {
    const _connectedPeers = rooms[room]; //Получаем массив пользователей комнаты

    for (const [socketID, _socket] of _connectedPeers.entries() ) { //Перебираем

      if (socketID !== socket.id) { //Себе не отправляем
        _socket.emit("joined-peers", { //Но отправляем остальным пользовтелям комнаты
          peerCount: rooms[room].size  //Информацию о размере комнаты
        });
      };
    };

  }

  broadcast()



  //При отключении пира данный метод оповестит пользователей его socketID для удаления из списка видеотрансляций
  //А так-же сообщит текущее количество соединений
  const disconnectedPeer = (socketID) => {
    const _connectedPeers = rooms[room]; //Получаем массив пользователей комнаты

    for (const [_socketID, _socket] of _connectedPeers.entries() ) { //Перебираем
 
        _socket.emit("peer-disconnected", {
          peerCount: rooms[room].size, //Отправляем и информацию о размере комнаты
          socketID                    //И id отсоединившегося абоннента 
        });
    } 

  }



  
  socket.on('disconnect', () => {
    console.log('disconnected')
    
    rooms[room].delete(socket.id) //При дисконекте удаляем пользователя из жителей комнаты
    disconnectedPeer(socket.id)  //И пользуемся методом что описан выше
  })


  //Лисенер позволяющий узнать кто на данный момент онлайн
  //Чтобы отправить им офферы
  socket.on("önlinePeers", (data) => {
    const _connectedPeers = rooms[room]; //Получаем массив пользователей комнаты

    for (const [socketID, _socket] of _connectedPeers.entries()) { //Иттерируемся по пользователям

      if (socketID !== data.socketID.local) {                           //Себе отправлять не будем
        console.log(`Online peer ${data.socketID}, ${socketID}`)
        socket.emit("online-peer", socketID)                      //Пересылаем socketID имеющихся клиентов, для дальнейшего создания офферов
      }
    }
  })


  //Получаем оффер с сервера
  socket.on("offer", data => { 
    const _connectedPeers = rooms[room]; //Получаем массив пользователей комнаты


    for (const [socketID, socket] of _connectedPeers.entries()) {

      if (socketID === data.socketID.remote) { //Пересылаем его клиенту, у которого socketID совпадает с полученным socketID

        console.log(socketID, data.payload.type)

        socket.emit("offer", {  
          sdp: data.payload,   //Отправляем оффер
          socketID: data.socketID.local //Так-же высылаем локальный socketID, который идентифицирует создателя оффера
        })

      }
    }
  });

  //Получаем ответ
  socket.on("answer", (data) => {
    const _connectedPeers = rooms[room]; 

    for (const [socketID, socket] of _connectedPeers.entries()) {

      if (socketID === data.socketID.remote) {  //Пересылаем его клиенту, у которого socketID совпадает с полученным socketID
        
        socket.emit("answer", { //Пересылаем его клиенту
          sdp: data.payload,
          socketID: data.socketID.local
        });
      };
    };
  })


  //Тот-же код что и в лисенере выше
  //Только на этот раз получаем кандидата , и пересылаем клиенту
  socket.on('candidate', (data) => {

    const _connectedPeers = rooms[room];

    for (const [socketID, socket] of _connectedPeers.entries()) {
         
      if (socketID === data.socketID.remote) {

        console.log(socketID, data.payload)
        socket.emit('candidate', {
          candidate: data.payload,
          socketID: data.socketID.local
        });

      };
    };
  });

})