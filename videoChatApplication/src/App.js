import React, { Component } from 'react';

import io from 'socket.io-client'
import Video from "./Components/Video" //Компонент одной видеотраснляции
import Videos from "./Components/Videos" //Контейнер для компонента одной видеотрансляции

//Главный компонент

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      localStream: null, //Локальный стрим. Используется для отображения собственного лика, и во имя избежания пересоздания стрима при новом каждом оффере
      remoteStream: null, //Стрим нашего партнёра по видеочату. А конкретно, переменная хранит стрим трансляции вкоторую мы выбрали для отображения на весь экран

      remoteStreams: [], //Список удалённых видеотрансляций
      peerConnections: {}, //Список пиров
      selectedVideo: null, //Трансляция которую пользователь выбрал для отображения во весь экран

      status: "Please wait...",  //Статус отображается пока загружается страница

      pc_config: {  //Конфигурация соединения пира
        "iceServers": [
          {
            urls : 'stun:stun.l.google.com:19302'
          }
        ]
      },

      constraints: { //Конфигурация получаемых медиа
        audio: true,
        video: true,
        options: {
          mirror: true,
        }
      },

      sdpConstraints: { //Конфигурация оффера
        "mandatory": {
          "OfferToReceiveAudio" : true,
          "OfferToReceiveVideo" : true
        }
      },

    };

    this.serviceIP = "localhost:8080/webrtcPeer"; //Адрес для обращения к сокетам

    // https://reactjs.org/docs/refs-and-the-dom.html

    this.socket = null; //Резерв для сокета


  }

  //Метод для получения медиа от пользователя
  getLocalStream = () => {


    const success = (stream) => {
      window.localStream = stream
      this.setState({
        localStream: stream //Записываем стрим в стейт для дальнейшего переиспользования
      })

      this.whoisOnline(); //Узнаём о текущих соединениях
    }

    //Отлавливаем ошибку
    const failure = (e) => {
      console.log('getUserMedia Error: ', e)
    }

    navigator.mediaDevices.getUserMedia(this.state.constraints) //Получаем медиа
      .then(success)
      .catch(failure)  
  }

  whoisOnline = () => { //Функция которая позволяет узнать пользователю о текущих соединениях, и сформировать для них офферы
    this.sendToPeer("önlinePeers", null, {local: this.socket.id} )
  }

  sendToPeer = (messageType, payload, socketID) => { //Метод для работы с сокетом
    this.socket.emit(messageType, {
      socketID,
      payload
    })
  }
  
  //Функция для создания нового соединения
  createPeerConnection = (socketID, callback) => {
    try {

      let pc = new RTCPeerConnection(this.state.pc_config) 

      //socketID используется для дальнейшего взаимодействия с пиром, и идентификации его в массиве подключений
      const peerConnections = {...this.state.peerConnections, [socketID]: pc }
      this.setState({
        peerConnections //Сохраняем подключение в списке
      })


      //При нахождении кандидата мы будем пересылать его соотвествующему клиенту
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id, //Для этого мы идентифицируем на сервере своё соединение
            remote: socketID  //И с помощью полученного socketID идентифицируем клиента, которому необходимо переправить кандидата
          })
        }
      };

/* 
      //Удаляем из списка стримов отключившиегося пира
      pc.oniceconnectionstatechange = (e) => {
        if(pc.iceConnectionState === "disconnected") {
          const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== socketID)

          this.setState({
            remoteStream: remoteStreams.length > 0 && remoteStreams[0].stream || null,
          })
        }
      } */


      //При появлении в пире стрима - добавляем стрим в список стримов, для последующего отображения
      pc.ontrack = (e) => {
        const remoteVideo = { //Получаем экземпляр стрима
          id: socketID, //Информация для идентификации стрима 
          name: socketID,
          stream: e.streams[0]
        }

        this.setState(prevState => {

          //В случае если до получения стрима в комнате не было трансляций - мы получаем эту трансляцию на весь экран
          //Если же в комнате уже есть трансляции - всё остается прежним
          const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] };

          //Получаем выбранное на данный момент видео
          let selectedVideo = prevState.remoteStreams.filter(stream => stream.id === prevState.selectedVideo.id);


          //Если видео всё ещё имеется - ничего не происходит
          //В ином случае отображаем на весь экран полученный стрим
          selectedVideo = selectedVideo.length ? {} : { selectedVideo: remoteVideo};

          return {
            ...selectedVideo, //Обновляем выбранное видео, если логика выше его получила
            ...remoteStream,  //Так-же обновляем стрим, он передаётся в компонент который отображает видео на весь экран
            remoteStreams: [...prevState.remoteStreams, remoteVideo] //Обновляем список стримов, добавляя в него полученный экземпляр
          };
        });
      };

      pc.close = () => {

      }

      if (this.state.localStream)
      pc.addStream(this.state.localStream) //Добавляем свой в пир свой стрим

      callback(pc) //Возвращаем pc для взаимодействия

    } catch(e) { //Отлавливаем ошибку
      console.log("Something went wrong! Pc not created", e)
      callback(null);
    }
  }
  


  componentDidMount = () => {


    //Подключаемся к socket.io
    this.socket = io.connect(
      this.serviceIP,
      {
        path: '/io/webrtc',
        query: {
          room: window.location.pathname, //Получаем комнату
        }
      }
    );




    //До подключения в интерфейсе клиент видит статус "Please waite..."
    //При успешном соединении к сокетам клиент получает количество подключенных пиров
    //Затем оно отображается в UI с помощью переменной status

    this.socket.on('connection-success', data => {

      this.getLocalStream(); //В случае удачного подключения к серверу - получаем медиа


      console.log(data.success);

      const status = data.peerCount > 1 ? `Total connected peers to room ${window.location.pathname} : ${data.peerCount}` : `Waiting for other peers to connect`;

      this.setState({
        status: status
      });

    });

    //Обновляем информацию о количестве соединений для текущих пользователей
    this.socket.on("joined-peers", data => {

      this.setState({
        status: data.peerCount > 1 ? `Total connected peers to room ${window.location.pathname} : ${data.peerCount}` : `Waiting for other peers to connect`,
      })
      
    })


    this.socket.on("peer-disconnected", data => {
      console.log("peer-disconnected", data);

      //При дисконнекте пира необходимо обновить список стримов
      const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== data.socketID)

      this.setState( prevState => {

        //Так-же проверяем, не отключился ли случаем пир, трансляцию которого мы выбрали
        //В таком случае, выбирается первый имеющийся в массиве стрим
        const selectedVideo = prevState.selectedVideo.id === data.socketID && remoteStreams.length ? { selectedVideo: remoteStreams[0] } : null;

        //Обновляем данные
        //Так-же при дисконнекте обновляем в статусе количество активных пользователей
        return {
          remoteStreams,
          ...selectedVideo,
          status: data.peerCount > 1 ? `Total connected peers to room ${window.location.pathname} : ${data.peerCount}` : `Waiting for other peers to connect`,
        };

      });

    });


    //Получаем кандидата
    this.socket.on('candidate', (data) => {
      const pc = this.state.peerConnections[data.socketID] //Идентифицируем нужный кандидату peerconnection по socketID

      if(pc)
      pc.addIceCandidate(new RTCIceCandidate(data.candidate)) //Добавляем кандидата
    });


    //Архитектура такова, что новый пользователь запрашивает с сервера список текущих соединений, затем формирует для них офферы
    //Пиры в свою очередь ему отвечают
    
    //На этот лисенер будут приходить socketID подключенных пиров
    //На каждый полученный socketID мы будем создавать новое соединение и формировать оффер
    this.socket.on("online-peer", socketID => {
      console.log(`Connected peers... ${socketID}`)

      this.createPeerConnection(socketID, pc => { //Создаём соединение

        if (pc) //В случае создания соединения создаём оффер
        pc.createOffer(this.state.sdpConstraints)
          .then(sdp => {
            pc.setLocalDescription(sdp) //Устанавливаем локальное описание
  
            this.sendToPeer("offer", sdp, { //Отсылаем локальное описание на сервер
              local: this.socket.id, //Локальный socketID для идентификации создателя оффера
              remote: socketID //Удалённый socketID для идентификации получателя оффера
            });

          })
      })
    });

    //В данном лисенере получаем оффер
    this.socket.on("offer", data => {
      
      this.createPeerConnection(data.socketID, pc => {
        pc.addStream(this.state.localStream) //Добавляем в соединение наш локальный стрим

        pc.setRemoteDescription( new RTCSessionDescription(data.sdp) ) //Устанавливаем удалённое описание, с помощью полученного оффера
          .then(() => { 
            pc.createAnswer(this.state.sdpConstraints) //Затем создаём ответ
              .then(sdp => {
                pc.setLocalDescription(sdp) //И устанавливаем локальное описание
  
                this.sendToPeer("answer", sdp, { //Локальное описание отправляем обратно на сервер, чтобы перебросить создателю оффера
                  local: this.socket.id,
                  remote: data.socketID,
                });
  
              });
         });
      })
    });


    //Получаем ответ
    this.socket.on("answer", data => {
      const pc = this.state.peerConnections[data.socketID] //Идентифицируем нужный ответу peerconnection по socketID
      
      pc.setRemoteDescription( new RTCSessionDescription(data.sdp) ) //Устанавливаем удалённое описание
    });

  };


  //Функция что выбирает трансляцию для отображения во весь экран
  switchVideo = (_video) => {
    console.log(_video);
    this.setState({
      selectedVideo: _video
    });
    
  };



  render() {
    
    console.log(this.state.localStream);
    
    //Статус который видит пользователь, отображает "Wait please" либо же количество пиров в комнате
    const statusText = <div style = {{ color: "yellow", padding: 5}}> {this.state.status} </div>

    return (
      <div>
        <Video //Локальное видео, смотрим себя
          videoStyles={{
            zIndex: 2,
            position: "absolute",
            right: 0,
            width: 250,
            height: 250,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ this.localVideoref } //Сюда отдаём локальный стрим
          videoStream={ this.state.localStream }
          autoPlay muted>
        </Video>

        <Video //Трансляция выбранная для отображения во весь экран
          videoStyles={{
            zIndex:1,
            position:"fixed",
            bottom: 0,
            minWidth: "100%",
            minHeight: "100%",
            backgroundColor: 'black'
          }}
          ref={ this.remoteVideoref }
          videoStream = { this.state.selectedVideo && this.state.selectedVideo.stream } //Сюда передаём выбранное видео, и стрим выбранного видео
          autoPlay>
        </Video>

        <br />
        <div style={{  //Статус соединения
          zIndex: 3,
          position: "absolute",
          margin: 10,
          backgroundColor: "#cdc4ff4f",
          padding: 10,
          borderRadius: 5,
        }}
        >
        { statusText }
        </div>

        <div>
          <Videos  //Контейнер для видеотрансляций, отображает в себе имеющиеся трансляции пользователей
            switchVideo = { this.switchVideo }                   //Функция для отображения конкретной трансляции
            remoteStreams= { this.state.remoteStreams } //На вход получает список трансляций
          ></Videos>
        </div>
        <br />

      </div>
    );
  };
};

export default App;